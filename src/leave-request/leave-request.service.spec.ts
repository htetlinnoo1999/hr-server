import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { S3Service } from '../upload/s3.service.ts';

const mockS3 = {
  uploadFile: jest.fn<any>(),
};

const mockPrisma = {
  employee: {
    findUnique: jest.fn<any>(),
  },
  leaveType: {
    findUnique: jest.fn<any>(),
  },
  leaveBalance: {
    findFirst: jest.fn<any>(),
    update: jest.fn<any>(),
  },
  leaveRequest: {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
  },
  publicHoliday: {
    findMany: jest.fn<any>(),
  },
  $transaction: jest.fn<any>(),
};
mockPrisma.$transaction.mockImplementation((queries: any) =>
  Promise.all(queries),
);
mockPrisma.publicHoliday.findMany.mockResolvedValue([]);

const adminUser = {
  id: 'u-admin',
  email: 'admin@peoplify.app',
  role: 'ADMIN',
  organizationId: 'org1',
};
const hrUser = {
  id: 'u-hr',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};
const orglessUser = {
  id: 'u-none',
  email: 'nobody@x.com',
  role: 'HR_MANAGER',
  organizationId: null,
};

const annualLeaveType = {
  id: 'lt-annual',
  organizationId: 'org1',
  restrictedGender: null,
};
const maternalLeaveType = {
  id: 'lt-maternal',
  organizationId: 'org1',
  restrictedGender: 'FEMALE',
};

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    service = module.get<LeaveRequestService>(LeaveRequestService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      employeeId: 'emp1',
      leaveTypeId: 'lt-annual',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      reason: 'Vacation',
    };

    it('creates a leave request and counts only weekdays (Mon-Wed)', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);
      const created = { id: '1', ...dto, totalDays: 3, status: 'PENDING' };
      mockPrisma.leaveRequest.create.mockResolvedValue(created);

      const result = await service.create(dto as any, hrUser as any);

      expect(mockPrisma.publicHoliday.findMany).toHaveBeenCalledWith({
        where: {
          countryId: 'country1',
          date: { gte: new Date('2026-08-03'), lte: new Date('2026-08-05') },
        },
        select: { date: true },
      });
      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp1',
          leaveTypeId: 'lt-annual',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-05'),
          totalDays: 3,
          reason: 'Vacation',
          attachmentUrls: [],
        },
      });
      expect(result).toEqual(created);
    });

    it('uploads image attachments to S3 and stores their URLs', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);
      mockPrisma.leaveRequest.create.mockResolvedValue({ id: '1' });
      mockS3.uploadFile
        .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/a.jpg')
        .mockResolvedValueOnce('https://bucket.s3.amazonaws.com/b.png');

      const files = [
        { originalname: 'a.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('a') },
        { originalname: 'b.png', mimetype: 'image/png', buffer: Buffer.from('b') },
      ];

      await service.create(dto as any, hrUser as any, files as any);

      expect(mockS3.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockS3.uploadFile).toHaveBeenNthCalledWith(
        1,
        files[0].buffer,
        expect.stringMatching(/^leave-requests\/emp1\/.*-0\.jpg$/),
        'image/jpeg',
      );
      expect(mockS3.uploadFile).toHaveBeenNthCalledWith(
        2,
        files[1].buffer,
        expect.stringMatching(/^leave-requests\/emp1\/.*-1\.png$/),
        'image/png',
      );
      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attachmentUrls: [
            'https://bucket.s3.amazonaws.com/a.jpg',
            'https://bucket.s3.amazonaws.com/b.png',
          ],
        }),
      });
    });

    it('excludes weekends from the day count', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);
      mockPrisma.leaveRequest.create.mockResolvedValue({ id: '1' });

      // Sat 2026-08-01 through Mon 2026-08-03 -> only the Monday counts
      await service.create(
        { ...dto, startDate: '2026-08-01', endDate: '2026-08-03' } as any,
        hrUser as any,
      );

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp1',
          leaveTypeId: 'lt-annual',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-03'),
          totalDays: 1,
          reason: 'Vacation',
          attachmentUrls: [],
        },
      });
    });

    it('excludes public holidays that fall on a weekday from the day count', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);
      mockPrisma.publicHoliday.findMany.mockResolvedValueOnce([
        { date: new Date('2026-08-04') },
      ]);
      mockPrisma.leaveRequest.create.mockResolvedValue({ id: '1' });

      await service.create(dto as any, hrUser as any);

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp1',
          leaveTypeId: 'lt-annual',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-05'),
          totalDays: 2,
          reason: 'Vacation',
          attachmentUrls: [],
        },
      });
    });

    it('throws BadRequestException when the range contains no working days', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);

      await expect(
        service.create(
          { ...dto, startDate: '2026-08-01', endDate: '2026-08-02' } as any,
          hrUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('allows an admin to create a leave request for an employee in any organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org2',
        gender: 'MALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue({
        ...annualLeaveType,
        organizationId: 'org2',
      });
      const created = { id: '1', ...dto, totalDays: 3, status: 'PENDING' };
      mockPrisma.leaveRequest.create.mockResolvedValue(created);

      await service.create(dto as any, adminUser as any);

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin submits for an employee in another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org2',
        gender: 'MALE',
      });

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the leave type does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the leave type belongs to another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue({
        ...annualLeaveType,
        organizationId: 'org2',
      });

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the leave type is gender-restricted and the employee does not match', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(maternalLeaveType);

      await expect(
        service.create(
          { ...dto, leaveTypeId: 'lt-maternal' } as any,
          hrUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('allows a gender-restricted leave type when the employee matches', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'FEMALE',
        countryId: 'country1',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(maternalLeaveType);
      mockPrisma.leaveRequest.create.mockResolvedValue({ id: '1' });

      await service.create(
        { ...dto, leaveTypeId: 'lt-maternal' } as any,
        hrUser as any,
      );

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when endDate is before startDate', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
        gender: 'MALE',
      });
      mockPrisma.leaveType.findUnique.mockResolvedValue(annualLeaveType);
      const badDto = { ...dto, startDate: '2026-08-03', endDate: '2026-08-01' };

      await expect(
        service.create(badDto as any, hrUser as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('scopes non-admins to their own organization while applying filters', async () => {
      const leaveRequests = [{ id: '1' }];
      mockPrisma.leaveRequest.findMany.mockResolvedValue(leaveRequests);
      mockPrisma.leaveRequest.count.mockResolvedValue(1);

      const result = await service.findAll(
        hrUser as any,
        'emp1',
        'PENDING' as any,
      );

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp1',
          status: 'PENDING',
          employee: { organizationId: 'org1' },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: leaveRequests,
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('lets an admin list across all organizations with no employee-org filter', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);

      await service.findAll(adminUser as any);

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: undefined,
          status: undefined,
          employee: undefined,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('computes skip from the requested page and limit', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, undefined, undefined, 5, 5);

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: undefined,
          status: undefined,
          employee: undefined,
        },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 5,
      });
    });

    it('throws ForbiddenException for a non-admin with no organization', async () => {
      await expect(service.findAll(orglessUser as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.leaveRequest.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the leave request (without joined relations) when found in the caller org', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org1' },
        leaveType: { id: 'lt-annual' },
      });

      const result = await service.findOne('abc', hrUser as any);

      expect(mockPrisma.leaveRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
        include: {
          employee: { include: { organization: true } },
          leaveType: true,
        },
      });
      expect(result).toEqual({ id: 'abc', status: 'PENDING' });
    });

    it('lets an admin fetch a leave request from any organization', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org2' },
        leaveType: { id: 'lt-annual' },
      });

      const result = await service.findOne('abc', adminUser as any);

      expect(result).toEqual({ id: 'abc', status: 'PENDING' });
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when a non-admin requests a leave request from another organization', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org2' },
        leaveType: { id: 'lt-annual' },
      });

      await expect(service.findOne('abc', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // cancel
  // ---------------------------------------------------------------------------
  describe('cancel', () => {
    it('cancels a pending leave request', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org1' },
        leaveType: { id: 'lt-annual' },
      });
      const cancelled = { id: 'abc', status: 'CANCELLED' };
      mockPrisma.leaveRequest.update.mockResolvedValue(cancelled);

      const result = await service.cancel('abc', hrUser as any);

      expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { status: 'CANCELLED' },
      });
      expect(result).toEqual(cancelled);
    });

    it('throws ConflictException when the request is not pending', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'APPROVED',
        employee: { organizationId: 'org1' },
        leaveType: { id: 'lt-annual' },
      });

      await expect(service.cancel('abc', hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the leave request does not exist', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(service.cancel('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin cancels a leave request from another organization', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org2' },
        leaveType: { id: 'lt-annual' },
      });

      await expect(service.cancel('abc', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // approve
  // ---------------------------------------------------------------------------
  describe('approve', () => {
    const pendingRequest = {
      id: 'abc',
      employeeId: 'emp1',
      leaveTypeId: 'lt-annual',
      startDate: new Date('2026-08-01'),
      totalDays: 3,
      status: 'PENDING',
      employee: {
        organizationId: 'org1',
        organization: { unlimitedLeave: false },
      },
      leaveType: annualLeaveType,
    };

    it('approves and deducts the matching balance', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue({
        id: 'bal1',
        usedDays: 2,
        remainingDays: 12,
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });
      mockPrisma.leaveBalance.update.mockResolvedValue({});

      const result = await service.approve('abc', {}, hrUser as any);

      expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: {
          status: 'APPROVED',
          reviewedBy: hrUser.id,
          reviewNote: undefined,
        },
      });
      expect(mockPrisma.leaveBalance.update).toHaveBeenCalledWith({
        where: { id: 'bal1' },
        data: { usedDays: 5, remainingDays: 9 },
      });
      expect(result.status).toBe('APPROVED');
    });

    it('throws ConflictException when balance is insufficient and enforcement is on', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue({
        id: 'bal1',
        usedDays: 12,
        remainingDays: 2,
      });

      await expect(service.approve('abc', {}, hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('approves despite insufficient balance when the org allows unlimited leave', async () => {
      const unlimitedOrgRequest = {
        ...pendingRequest,
        employee: {
          organizationId: 'org1',
          organization: { unlimitedLeave: true },
        },
      };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(unlimitedOrgRequest);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue({
        id: 'bal1',
        usedDays: 12,
        remainingDays: 2,
      });
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...unlimitedOrgRequest,
        status: 'APPROVED',
      });
      mockPrisma.leaveBalance.update.mockResolvedValue({});

      const result = await service.approve('abc', {}, hrUser as any);

      expect(mockPrisma.leaveBalance.update).toHaveBeenCalledWith({
        where: { id: 'bal1' },
        data: { usedDays: 15, remainingDays: -1 },
      });
      expect(result.status).toBe('APPROVED');
    });

    it('approves without touching balances when no matching balance exists', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue(null);
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });

      const result = await service.approve('abc', {}, hrUser as any);

      expect(mockPrisma.leaveBalance.update).not.toHaveBeenCalled();
      expect(result.status).toBe('APPROVED');
    });

    it('throws ConflictException when the request is not pending', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });

      await expect(service.approve('abc', {}, hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the employee tries to approve their own request', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);

      await expect(
        service.approve('abc', {}, { ...hrUser, id: 'emp1' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("allows the employee's own manager (a plain EMPLOYEE role) to approve", async () => {
      const managedRequest = {
        ...pendingRequest,
        employee: { ...pendingRequest.employee, managerId: 'mgr1' },
      };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(managedRequest);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue(null);
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...managedRequest,
        status: 'APPROVED',
      });

      const manager = {
        id: 'mgr1',
        email: 'manager@acme.com',
        role: 'EMPLOYEE',
        organizationId: 'org1',
      };
      const result = await service.approve('abc', {}, manager as any);

      expect(result.status).toBe('APPROVED');
    });

    it('throws ForbiddenException when an unrelated EMPLOYEE tries to approve', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        employee: { ...pendingRequest.employee, managerId: 'mgr1' },
      });

      const stranger = {
        id: 'someone-else',
        email: 'stranger@acme.com',
        role: 'EMPLOYEE',
        organizationId: 'org1',
      };

      await expect(service.approve('abc', {}, stranger as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // reject
  // ---------------------------------------------------------------------------
  describe('reject', () => {
    const pendingRequest = {
      id: 'abc',
      employeeId: 'emp1',
      leaveTypeId: 'lt-annual',
      status: 'PENDING',
      employee: {
        organizationId: 'org1',
        organization: { unlimitedLeave: false },
      },
      leaveType: annualLeaveType,
    };

    it('rejects a pending leave request without touching balances', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...pendingRequest,
        status: 'REJECTED',
      });

      const result = await service.reject(
        'abc',
        { reviewNote: 'Not enough coverage' },
        hrUser as any,
      );

      expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: {
          status: 'REJECTED',
          reviewedBy: hrUser.id,
          reviewNote: 'Not enough coverage',
        },
      });
      expect(mockPrisma.leaveBalance.update).not.toHaveBeenCalled();
      expect(result.status).toBe('REJECTED');
    });

    it('throws ConflictException when the request is not pending', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        ...pendingRequest,
        status: 'CANCELLED',
      });

      await expect(service.reject('abc', {}, hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the employee tries to reject their own request', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(pendingRequest);

      await expect(
        service.reject('abc', {}, { ...hrUser, id: 'emp1' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("allows the employee's own manager (a plain EMPLOYEE role) to reject", async () => {
      const managedRequest = {
        ...pendingRequest,
        employee: { ...pendingRequest.employee, managerId: 'mgr1' },
      };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(managedRequest);
      mockPrisma.leaveRequest.update.mockResolvedValue({
        ...managedRequest,
        status: 'REJECTED',
      });

      const manager = {
        id: 'mgr1',
        email: 'manager@acme.com',
        role: 'EMPLOYEE',
        organizationId: 'org1',
      };
      const result = await service.reject('abc', {}, manager as any);

      expect(result.status).toBe('REJECTED');
    });
  });
});
