import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveBalanceService } from './leave-balance.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  employee: {
    findUnique: jest.fn<any>(),
  },
  leaveType: {
    findUnique: jest.fn<any>(),
  },
  leaveBalance: {
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
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
const otherOrgUser = {
  id: 'u-other',
  email: 'hr@other.com',
  role: 'HR_MANAGER',
  organizationId: 'org2',
};

describe('LeaveBalanceService', () => {
  let service: LeaveBalanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveBalanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaveBalanceService>(LeaveBalanceService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      employeeId: 'emp1',
      leaveTypeId: 'lt1',
      year: 2026,
      totalDays: 14,
    };
    const employee = { id: 'emp1', organizationId: 'org1' };
    const leaveType = { id: 'lt1', organizationId: 'org1' };

    it('creates a balance with remainingDays equal to totalDays', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue(null);
      mockPrisma.leaveBalance.create.mockResolvedValue({
        id: 'b1',
        ...dto,
        usedDays: 0,
        remainingDays: 14,
      });

      const result = await service.create(dto as any, hrUser as any);

      expect(mockPrisma.leaveBalance.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp1',
          leaveTypeId: 'lt1',
          year: 2026,
          totalDays: 14,
          usedDays: 0,
          remainingDays: 14,
        },
      });
      expect(result.remainingDays).toBe(14);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.create(dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin creates for an employee outside their org', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(
        service.create(dto as any, otherOrgUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the leave type does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue(null);

      await expect(
        service.create(dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the leave type belongs to another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt1',
        organizationId: 'org2',
      });

      await expect(
        service.create(dto as any, hrUser as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a balance already exists for employee/leaveType/year', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(dto as any, hrUser as any),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('scopes non-admins to their own organization', async () => {
      const balances = [{ id: 'b1' }];
      mockPrisma.leaveBalance.findMany.mockResolvedValue(balances);
      mockPrisma.leaveBalance.count.mockResolvedValue(1);

      const result = await service.findAll(hrUser as any);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: undefined,
          year: undefined,
          employee: { organizationId: 'org1' },
        },
        orderBy: { year: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: balances, total: 1, page: 1, limit: 20 });
    });

    it('lets an admin list all balances when no filters are given', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([]);
      mockPrisma.leaveBalance.count.mockResolvedValue(0);

      await service.findAll(adminUser as any);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: { employeeId: undefined, year: undefined, employee: undefined },
        orderBy: { year: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('computes skip from the requested page and limit', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([]);
      mockPrisma.leaveBalance.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, undefined, undefined, 2, 10);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: { employeeId: undefined, year: undefined, employee: undefined },
        orderBy: { year: 'desc' },
        skip: 10,
        take: 10,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const balance = {
      id: 'b1',
      employeeId: 'emp1',
      employee: { organizationId: 'org1' },
    };

    it('returns the balance when found within the caller organization', async () => {
      mockPrisma.leaveBalance.findUnique.mockResolvedValue(balance);

      const result = await service.findOne('b1', hrUser as any);

      expect(result).toEqual({ id: 'b1', employeeId: 'emp1' });
    });

    it('throws NotFoundException when the balance does not exist', async () => {
      mockPrisma.leaveBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('missing', hrUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the balance belongs to another organization', async () => {
      mockPrisma.leaveBalance.findUnique.mockResolvedValue(balance);

      await expect(
        service.findOne('b1', otherOrgUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('recomputes remainingDays from the new totalDays minus usedDays', async () => {
      mockPrisma.leaveBalance.findUnique.mockResolvedValue({
        id: 'b1',
        employeeId: 'emp1',
        usedDays: 5,
        employee: { organizationId: 'org1' },
      });
      mockPrisma.leaveBalance.update.mockResolvedValue({
        id: 'b1',
        totalDays: 20,
        usedDays: 5,
        remainingDays: 15,
      });

      const result = await service.update(
        'b1',
        { totalDays: 20 } as any,
        hrUser as any,
      );

      expect(mockPrisma.leaveBalance.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { totalDays: 20, remainingDays: 15 },
      });
      expect(result.remainingDays).toBe(15);
    });
  });
});
