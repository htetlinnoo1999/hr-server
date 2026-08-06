import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.ts';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { LeaveStatus, Role } from '../../generated/prisma/enums.js';
import { S3Service } from '../upload/s3.service.ts';

@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /** Counts working days (inclusive), excluding weekends and the employee's country's public holidays. */
  private async calculateTotalDays(
    startDate: Date,
    endDate: Date,
    countryId: string,
  ): Promise<number> {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: { countryId, date: { gte: startDate, lte: endDate } },
      select: { date: true },
    });
    const holidayDates = new Set(
      holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
    );

    let totalDays = 0;
    const cursor = new Date(startDate);
    while (cursor.getTime() <= endDate.getTime()) {
      const dayOfWeek = cursor.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidayDates.has(cursor.toISOString().slice(0, 10));
      if (!isWeekend && !isHoliday) {
        totalDays++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return totalDays;
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

  /** Reviewer must be an admin, HR manager, or the requester's own manager — never the requester themself. */
  private assertCanReview(
    leaveRequest: {
      employeeId: string;
      employee: { managerId: string | null };
    },
    user: AuthenticatedUser,
  ) {
    if (leaveRequest.employeeId === user.id) {
      throw new ForbiddenException('You cannot review your own leave request');
    }
    const isOwnManager = leaveRequest.employee.managerId === user.id;
    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.HR_MANAGER &&
      !isOwnManager
    ) {
      throw new ForbiddenException(
        "Only an admin, HR manager, or the employee's manager can review this request",
      );
    }
  }

  /** Fetches a leave request with its employee/organization/leave type, enforcing org access. */
  private async findWithRelations(id: string, user: AuthenticatedUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { organization: true } },
        leaveType: true,
      },
    });
    if (!leaveRequest) {
      throw new NotFoundException(`Leave request ${id} not found`);
    }
    this.assertOrgAccess(leaveRequest, user);
    return leaveRequest;
  }

  async create(
    dto: CreateLeaveRequestDto,
    user: AuthenticatedUser,
    files: Express.Multer.File[] = [],
  ) {
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
    if (
      leaveType.restrictedGender &&
      employee.gender !== leaveType.restrictedGender
    ) {
      throw new BadRequestException(
        `This leave type is restricted to ${leaveType.restrictedGender} employees`,
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    const totalDays = await this.calculateTotalDays(
      startDate,
      endDate,
      employee.countryId,
    );
    if (totalDays <= 0) {
      throw new BadRequestException(
        'Leave request must include at least one working day (excluding weekends and public holidays)',
      );
    }

    const attachmentUrls = await Promise.all(
      files.map((file, index) => {
        const extension = file.originalname.split('.').pop() ?? 'jpg';
        const key = `leave-requests/${dto.employeeId}/${Date.now()}-${index}.${extension}`;
        return this.s3.uploadFile(file.buffer, key, file.mimetype);
      }),
    );

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        attachmentUrls,
      },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    employeeId?: string,
    status?: LeaveStatus,
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
      status: status ?? undefined,
      employee:
        user.role === Role.ADMIN
          ? undefined
          : { organizationId: user.organizationId ?? undefined },
    };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const {
      employee: _employee,
      leaveType: _leaveType,
      ...rest
    } = await this.findWithRelations(id, user);
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

  async approve(
    id: string,
    dto: ReviewLeaveRequestDto,
    user: AuthenticatedUser,
  ) {
    const leaveRequest = await this.findWithRelations(id, user);
    this.assertCanReview(leaveRequest, user);
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new ConflictException(
        'Only pending leave requests can be approved',
      );
    }

    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: leaveRequest.employeeId,
        leaveTypeId: leaveRequest.leaveTypeId,
        year: leaveRequest.startDate.getFullYear(),
      },
    });

    if (
      balance &&
      !leaveRequest.employee.organization.unlimitedLeave &&
      balance.remainingDays < leaveRequest.totalDays
    ) {
      throw new ConflictException('Insufficient leave balance');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          reviewedBy: user.id,
          reviewNote: dto.reviewNote,
        },
      }),
      ...(balance
        ? [
            this.prisma.leaveBalance.update({
              where: { id: balance.id },
              data: {
                usedDays: balance.usedDays + leaveRequest.totalDays,
                remainingDays: balance.remainingDays - leaveRequest.totalDays,
              },
            }),
          ]
        : []),
    ]);

    return updated;
  }

  async reject(
    id: string,
    dto: ReviewLeaveRequestDto,
    user: AuthenticatedUser,
  ) {
    const leaveRequest = await this.findWithRelations(id, user);
    this.assertCanReview(leaveRequest, user);
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new ConflictException(
        'Only pending leave requests can be rejected',
      );
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        reviewedBy: user.id,
        reviewNote: dto.reviewNote,
      },
    });
  }
}
