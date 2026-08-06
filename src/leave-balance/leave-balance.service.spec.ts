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
    findMany: jest.fn<any>(),
  },
  leaveBalance: {
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
    createMany: jest.fn<any>(),
    createManyAndReturn: jest.fn<any>(),
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
const orglessUser = {
  id: 'u-none',
  email: 'nobody@x.com',
  role: 'HR_MANAGER',
  organizationId: null,
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

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the leave type belongs to another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt1',
        organizationId: 'org2',
      });

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a balance already exists for employee/leaveType/year', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveBalance.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // bulkCreate
  // ---------------------------------------------------------------------------
  describe('bulkCreate', () => {
    const dto = {
      employeeId: 'emp1',
      year: 2026,
      balances: [
        { leaveTypeId: 'lt-sick', totalDays: 30 },
        { leaveTypeId: 'lt-annual', totalDays: 10 },
      ],
    };
    const employee = { id: 'emp1', organizationId: 'org1' };
    const leaveTypes = [
      { id: 'lt-sick', organizationId: 'org1' },
      { id: 'lt-annual', organizationId: 'org1' },
    ];

    it('creates one balance per leave type in a single call', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findMany.mockResolvedValue(leaveTypes);
      const createdRows = [
        { id: 'b1', employeeId: 'emp1', leaveTypeId: 'lt-sick', year: 2026 },
        { id: 'b2', employeeId: 'emp1', leaveTypeId: 'lt-annual', year: 2026 },
      ];
      mockPrisma.leaveBalance.createManyAndReturn.mockResolvedValue(
        createdRows,
      );

      const result = await service.bulkCreate(dto as any, hrUser as any);

      expect(mockPrisma.leaveType.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['lt-sick', 'lt-annual'] } },
      });
      expect(mockPrisma.leaveBalance.createManyAndReturn).toHaveBeenCalledWith(
        {
          data: [
            {
              employeeId: 'emp1',
              leaveTypeId: 'lt-sick',
              year: 2026,
              totalDays: 30,
              usedDays: 0,
              remainingDays: 30,
            },
            {
              employeeId: 'emp1',
              leaveTypeId: 'lt-annual',
              year: 2026,
              totalDays: 10,
              usedDays: 0,
              remainingDays: 10,
            },
          ],
          skipDuplicates: true,
        },
      );
      expect(result).toEqual({
        created: 2,
        skipped: 0,
        data: createdRows,
      });
    });

    it('reports skipped balances that already existed', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findMany.mockResolvedValue(leaveTypes);
      mockPrisma.leaveBalance.createManyAndReturn.mockResolvedValue([
        { id: 'b1', leaveTypeId: 'lt-sick' },
      ]);

      const result = await service.bulkCreate(dto as any, hrUser as any);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkCreate(dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.leaveBalance.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin creates for an employee outside their org', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(
        service.bulkCreate(dto as any, otherOrgUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveBalance.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the same leave type appears twice', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(
        service.bulkCreate(
          {
            ...dto,
            balances: [
              { leaveTypeId: 'lt-sick', totalDays: 30 },
              { leaveTypeId: 'lt-sick', totalDays: 5 },
            ],
          } as any,
          hrUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveBalance.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a leave type does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findMany.mockResolvedValue([leaveTypes[0]]);

      await expect(
        service.bulkCreate(dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.leaveBalance.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a leave type belongs to another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.leaveType.findMany.mockResolvedValue([
        leaveTypes[0],
        { id: 'lt-annual', organizationId: 'org2' },
      ]);

      await expect(
        service.bulkCreate(dto as any, hrUser as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveBalance.createManyAndReturn).not.toHaveBeenCalled();
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

      await expect(service.findOne('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the balance belongs to another organization', async () => {
      mockPrisma.leaveBalance.findUnique.mockResolvedValue(balance);

      await expect(service.findOne('b1', otherOrgUser as any)).rejects.toThrow(
        NotFoundException,
      );
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

  // ---------------------------------------------------------------------------
  // rollover
  // ---------------------------------------------------------------------------
  describe('rollover', () => {
    const dto = { fromYear: 2026, toYear: 2027 };

    it('carries forward days up to maxCarryDays for carryForward-enabled leave types', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([
        {
          employeeId: 'emp1',
          leaveTypeId: 'lt-annual',
          remainingDays: 6,
          leaveType: {
            daysPerYear: 14,
            carryForward: true,
            maxCarryDays: 5,
          },
        },
        {
          employeeId: 'emp1',
          leaveTypeId: 'lt-sick',
          remainingDays: 8,
          leaveType: {
            daysPerYear: 10,
            carryForward: false,
            maxCarryDays: 0,
          },
        },
      ]);
      mockPrisma.leaveBalance.createMany.mockResolvedValue({ count: 2 });

      const result = await service.rollover(dto as any, hrUser as any);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: { year: 2026, employee: { organizationId: 'org1' } },
        include: { leaveType: true },
      });
      expect(mockPrisma.leaveBalance.createMany).toHaveBeenCalledWith({
        data: [
          {
            employeeId: 'emp1',
            leaveTypeId: 'lt-annual',
            year: 2027,
            totalDays: 19, // 14 + min(6, 5) carried over
            usedDays: 0,
            remainingDays: 19,
          },
          {
            employeeId: 'emp1',
            leaveTypeId: 'lt-sick',
            year: 2027,
            totalDays: 10, // carryForward disabled
            usedDays: 0,
            remainingDays: 10,
          },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ created: 2 });
    });

    it('returns created: 0 without calling createMany when there is nothing to roll over', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([]);

      const result = await service.rollover(dto as any, hrUser as any);

      expect(mockPrisma.leaveBalance.createMany).not.toHaveBeenCalled();
      expect(result).toEqual({ created: 0 });
    });

    it('throws ForbiddenException when the caller has no organization', async () => {
      await expect(
        service.rollover(dto as any, orglessUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveBalance.findMany).not.toHaveBeenCalled();
    });

    it('rolls over the organization derived from the caller', async () => {
      mockPrisma.leaveBalance.findMany.mockResolvedValue([]);

      await service.rollover(dto as any, adminUser as any);

      expect(mockPrisma.leaveBalance.findMany).toHaveBeenCalledWith({
        where: { year: 2026, employee: { organizationId: 'org1' } },
        include: { leaveType: true },
      });
    });

    it('throws BadRequestException when toYear is not exactly one year after fromYear', async () => {
      await expect(
        service.rollover({ ...dto, toYear: 2029 } as any, hrUser as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.leaveBalance.findMany).not.toHaveBeenCalled();
    });
  });
});
