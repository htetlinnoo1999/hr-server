import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateDepartmentDto } from './dto/create-department.dto.ts';
import { UpdateDepartmentDto } from './dto/update-department.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-admins are confined to their own organization; a null org means no access at all. */
  private assertOrgAccess(
    department: { id: string; organizationId: string },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== Role.ADMIN &&
      department.organizationId !== user.organizationId
    ) {
      throw new NotFoundException(`Department ${department.id} not found`);
    }
  }

  /** A manager must be a real employee in the same organization, and can only manage one department. */
  private async assertValidManager(
    managerId: string,
    organizationId: string,
    departmentId?: string,
  ) {
    const manager = await this.prisma.employee.findUnique({
      where: { id: managerId },
    });
    if (!manager) {
      throw new NotFoundException(`Manager ${managerId} not found`);
    }
    if (manager.organizationId !== organizationId) {
      throw new BadRequestException(
        'Department manager must belong to the same organization',
      );
    }

    const existingAssignment = await this.prisma.department.findFirst({
      where: { managerId, id: { not: departmentId } },
    });
    if (existingAssignment) {
      throw new ConflictException(
        'This employee already manages another department',
      );
    }
  }

  async create(dto: CreateDepartmentDto, user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    const organizationId = user.organizationId;

    const existing = await this.prisma.department.findFirst({
      where: { name: dto.name, organizationId },
    });
    if (existing) {
      throw new ConflictException(
        'A department with this name already exists in the organization',
      );
    }

    if (dto.managerId) {
      await this.assertValidManager(dto.managerId, organizationId);
    }

    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { ...dto, organizationId },
      });
      if (dto.managerId) {
        await tx.employee.update({
          where: { id: dto.managerId },
          data: { departmentId: department.id },
        });
      }
      return department;
    });
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
      this.prisma.department.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.department.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundException(`Department ${id} not found`);
    this.assertOrgAccess(department, user);
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, user: AuthenticatedUser) {
    const department = await this.findOne(id, user);

    if (dto.name) {
      const conflict = await this.prisma.department.findFirst({
        where: {
          id: { not: id },
          name: dto.name,
          organizationId: department.organizationId,
        },
      });
      if (conflict) {
        throw new ConflictException(
          'A department with this name already exists in the organization',
        );
      }
    }

    if (dto.managerId) {
      await this.assertValidManager(
        dto.managerId,
        department.organizationId,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({ where: { id }, data: dto });
      if (dto.managerId) {
        await tx.employee.update({
          where: { id: dto.managerId },
          data: { departmentId: updated.id },
        });
      }
      return updated;
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);

    const employeeCount = await this.prisma.employee.count({
      where: { departmentId: id },
    });
    if (employeeCount > 0) {
      throw new ConflictException(
        'Cannot delete a department with employees assigned',
      );
    }

    return this.prisma.department.delete({ where: { id } });
  }
}
