import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class LeaveTypeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-admins are confined to their own organization; a null org means no access at all. */
  private assertOrgAccess(
    leaveType: { id: string; organizationId: string },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== Role.ADMIN &&
      leaveType.organizationId !== user.organizationId
    ) {
      throw new NotFoundException(`Leave type ${leaveType.id} not found`);
    }
  }

  async findAll(
    user: AuthenticatedUser,
    organizationId?: string,
    page = 1,
    limit = 20,
  ) {
    if (user.role !== Role.ADMIN && !user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    const scopedOrgId =
      user.role === Role.ADMIN ? organizationId : user.organizationId;
    const where = scopedOrgId ? { organizationId: scopedOrgId } : undefined;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.leaveType.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.leaveType.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });
    if (!leaveType) throw new NotFoundException(`Leave type ${id} not found`);
    this.assertOrgAccess(leaveType, user);
    return leaveType;
  }

  async update(id: string, dto: UpdateLeaveTypeDto, user: AuthenticatedUser) {
    const leaveType = await this.findOne(id, user);

    if (
      dto.organizationId &&
      dto.organizationId !== leaveType.organizationId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Cannot move a leave type to a different organization',
      );
    }

    if (dto.name) {
      const conflict = await this.prisma.leaveType.findFirst({
        where: {
          id: { not: id },
          name: dto.name,
          organizationId: dto.organizationId ?? leaveType.organizationId,
        },
      });
      if (conflict) {
        throw new ConflictException(
          'A leave type with this name already exists in the organization',
        );
      }
    }

    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);

    const balanceCount = await this.prisma.leaveBalance.count({
      where: { leaveTypeId: id },
    });
    const requestCount = await this.prisma.leaveRequest.count({
      where: { leaveTypeId: id },
    });
    if (balanceCount > 0 || requestCount > 0) {
      throw new ConflictException(
        'Cannot delete a leave type with existing balances or requests',
      );
    }

    return this.prisma.leaveType.delete({ where: { id } });
  }
}
