import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto.ts';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto.ts';
import { RolloverLeaveBalancesDto } from './dto/rollover-leave-balances.dto.ts';
import { BulkCreateLeaveBalancesDto } from './dto/bulk-create-leave-balances.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@Injectable()
export class LeaveBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-admins are confined to leave balances for employees in their own organization. */
  private assertOrgAccess(
    balance: { id: string; employee: { organizationId: string } },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== Role.ADMIN &&
      balance.employee.organizationId !== user.organizationId
    ) {
      throw new NotFoundException(`Leave balance ${balance.id} not found`);
    }
  }

  async create(dto: CreateLeaveBalanceDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }
    if (
      user.role !== Role.ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You can only create leave balances for employees in your own organization',
      );
    }

    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) {
      throw new NotFoundException(`Leave type ${dto.leaveTypeId} not found`);
    }
    if (leaveType.organizationId !== employee.organizationId) {
      throw new BadRequestException(
        'Leave type must belong to the same organization as the employee',
      );
    }

    const existing = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A leave balance for this employee, leave type, and year already exists',
      );
    }

    return this.prisma.leaveBalance.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        totalDays: dto.totalDays,
        usedDays: 0,
        remainingDays: dto.totalDays,
      },
    });
  }

  /**
   * Creates several leave balances for one employee in a single call, e.g.
   * sick leave 30, annual 10. Skips (rather than errors on) any leave
   * type/year combination the employee already has a balance for.
   */
  async bulkCreate(dto: BulkCreateLeaveBalancesDto, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }
    if (
      user.role !== Role.ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You can only create leave balances for employees in your own organization',
      );
    }

    const leaveTypeIds = dto.balances.map((balance) => balance.leaveTypeId);
    const uniqueLeaveTypeIds = new Set(leaveTypeIds);
    if (uniqueLeaveTypeIds.size !== leaveTypeIds.length) {
      throw new BadRequestException(
        'Each leave type may only appear once per request',
      );
    }

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { id: { in: leaveTypeIds } },
    });
    const foundIds = new Set(leaveTypes.map((leaveType) => leaveType.id));
    const missingId = leaveTypeIds.find((id) => !foundIds.has(id));
    if (missingId) {
      throw new NotFoundException(`Leave type ${missingId} not found`);
    }
    const foreignLeaveType = leaveTypes.find(
      (leaveType) => leaveType.organizationId !== employee.organizationId,
    );
    if (foreignLeaveType) {
      throw new BadRequestException(
        'Leave type must belong to the same organization as the employee',
      );
    }

    const created = await this.prisma.leaveBalance.createManyAndReturn({
      data: dto.balances.map((balance) => ({
        employeeId: dto.employeeId,
        leaveTypeId: balance.leaveTypeId,
        year: dto.year,
        totalDays: balance.totalDays,
        usedDays: 0,
        remainingDays: balance.totalDays,
      })),
      skipDuplicates: true,
    });

    return {
      created: created.length,
      skipped: dto.balances.length - created.length,
      data: created,
    };
  }

  async findAll(
    user: AuthenticatedUser,
    employeeId?: string,
    year?: number,
    page = 1,
    limit = 20,
  ) {
    if (user.role !== Role.ADMIN && !user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }

    const where = {
      employeeId: employeeId ?? undefined,
      year: year ?? undefined,
      employee:
        user.role === Role.ADMIN
          ? undefined
          : { organizationId: user.organizationId ?? undefined },
    };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.leaveBalance.findMany({
        where,
        orderBy: { year: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leaveBalance.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { id },
      include: { employee: { select: { organizationId: true } } },
    });
    if (!balance) throw new NotFoundException(`Leave balance ${id} not found`);
    this.assertOrgAccess(balance, user);
    const { employee: _employee, ...rest } = balance;
    return rest;
  }

  async update(
    id: string,
    dto: UpdateLeaveBalanceDto,
    user: AuthenticatedUser,
  ) {
    const balance = await this.findOne(id, user);
    return this.prisma.leaveBalance.update({
      where: { id },
      data: {
        totalDays: dto.totalDays,
        remainingDays: dto.totalDays - balance.usedDays,
      },
    });
  }

  /**
   * Creates next-year leave balances from an organization's existing balances,
   * applying each leave type's carryForward/maxCarryDays rules. Idempotent:
   * balances that already exist for the target year are left untouched.
   */
  async rollover(dto: RolloverLeaveBalancesDto, user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    if (dto.toYear !== dto.fromYear + 1) {
      throw new BadRequestException(
        'toYear must be exactly one year after fromYear',
      );
    }

    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        year: dto.fromYear,
        employee: { organizationId: user.organizationId },
      },
      include: { leaveType: true },
    });

    if (!balances.length) {
      return { created: 0 };
    }

    const data = balances.map((balance) => {
      const carry = balance.leaveType.carryForward
        ? Math.min(balance.remainingDays, balance.leaveType.maxCarryDays)
        : 0;
      const totalDays = balance.leaveType.daysPerYear + carry;
      return {
        employeeId: balance.employeeId,
        leaveTypeId: balance.leaveTypeId,
        year: dto.toYear,
        totalDays,
        usedDays: 0,
        remainingDays: totalDays,
      };
    });

    const result = await this.prisma.leaveBalance.createMany({
      data,
      skipDuplicates: true,
    });
    return { created: result.count };
  }
}
