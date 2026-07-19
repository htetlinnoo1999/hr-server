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

const mockPrisma = {
  employee: {
    findUnique: jest.fn<any>(),
  },
  leaveRequest: {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
  },
};

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

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        { provide: PrismaService, useValue: mockPrisma },
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
      leaveType: 'ANNUAL',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      reason: 'Vacation',
    };

    it('creates a leave request and computes totalDays inclusively', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
      });
      const created = { id: '1', ...dto, totalDays: 3, status: 'PENDING' };
      mockPrisma.leaveRequest.create.mockResolvedValue(created);

      const result = await service.create(dto as any, hrUser as any);

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp1',
          leaveType: 'ANNUAL',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-03'),
          totalDays: 3,
          reason: 'Vacation',
        },
      });
      expect(result).toEqual(created);
    });

    it('allows an admin to create a leave request for an employee in any organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
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
      });

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endDate is before startDate', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        organizationId: 'org1',
      });
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
      });
      expect(result).toEqual(leaveRequests);
    });

    it('lets an admin list across all organizations with no employee-org filter', async () => {
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.findAll(adminUser as any);

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: undefined,
          status: undefined,
          employee: undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws ForbiddenException for a non-admin with no organization', () => {
      expect(() => service.findAll(orglessUser as any)).toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.leaveRequest.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the leave request (without the joined employee) when found in the caller org', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org1' },
      });

      const result = await service.findOne('abc', hrUser as any);

      expect(mockPrisma.leaveRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
        include: { employee: { select: { organizationId: true } } },
      });
      expect(result).toEqual({ id: 'abc', status: 'PENDING' });
    });

    it('lets an admin fetch a leave request from any organization', async () => {
      mockPrisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'abc',
        status: 'PENDING',
        employee: { organizationId: 'org2' },
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
      });

      await expect(service.cancel('abc', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveRequest.update).not.toHaveBeenCalled();
    });
  });
});
