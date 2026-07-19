import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { LeaveStatus, Role } from '../../generated/prisma/enums.js';

@Injectable()
export class LeaveRequestService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateTotalDays(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  }

  /** Non-admins are confined to leave requests for employees in their own organization. */
  private assertOrgAccess(
    leaveRequest: { id: string; employee: { organizationId: string } },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== Role.ADMIN &&
      leaveRequest.employee.organizationId !== user.organizationId
    ) {
      throw new NotFoundException(`Leave request ${leaveRequest.id} not found`);
    }
  }

  async create(dto: CreateLeaveRequestDto, user: AuthenticatedUser) {
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
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startDate,
        endDate,
        totalDays: this.calculateTotalDays(startDate, endDate),
        reason: dto.reason,
      },
    });
  }

  findAll(user: AuthenticatedUser, employeeId?: string, status?: LeaveStatus) {
    if (user.role !== Role.ADMIN && !user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }

    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId: employeeId ?? undefined,
        status: status ?? undefined,
        employee:
          user.role === Role.ADMIN
            ? undefined
            : { organizationId: user.organizationId ?? undefined },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { organizationId: true } } },
    });
    if (!leaveRequest)
      throw new NotFoundException(`Leave request ${id} not found`);
    this.assertOrgAccess(leaveRequest, user);
    const { employee: _employee, ...rest } = leaveRequest;
    return rest;
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const leaveRequest = await this.findOne(id, user);
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new ConflictException(
        'Only pending leave requests can be cancelled',
      );
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
    });
  }
}
