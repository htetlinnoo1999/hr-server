import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTypeService } from './leave-type.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  leaveType: {
    findFirst: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
  },
  leaveBalance: {
    count: jest.fn<any>(),
  },
  leaveRequest: {
    count: jest.fn<any>(),
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

describe('LeaveTypeService', () => {
  let service: LeaveTypeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveTypeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaveTypeService>(LeaveTypeService);
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('scopes non-admins to their own organization, ignoring the query param', async () => {
      const leaveTypes = [{ id: 'lt1' }];
      mockPrisma.leaveType.findMany.mockResolvedValue(leaveTypes);
      mockPrisma.leaveType.count.mockResolvedValue(1);

      const result = await service.findAll(hrUser as any, 'org2');

      expect(mockPrisma.leaveType.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: leaveTypes,
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('lets an admin list all leave types when no organizationId filter is given', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([]);
      mockPrisma.leaveType.count.mockResolvedValue(0);

      await service.findAll(adminUser as any);

      expect(mockPrisma.leaveType.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('computes skip from the requested page and limit', async () => {
      mockPrisma.leaveType.findMany.mockResolvedValue([]);
      mockPrisma.leaveType.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, undefined, 4, 5);

      expect(mockPrisma.leaveType.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 15,
        take: 5,
      });
    });

    it('throws ForbiddenException for a non-admin with no organization', async () => {
      await expect(service.findAll(orglessUser as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const leaveType = { id: 'lt1', name: 'Annual', organizationId: 'org1' };

    it('returns the leave type when found within the caller organization', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);

      const result = await service.findOne('lt1', hrUser as any);

      expect(result).toEqual(leaveType);
    });

    it('throws NotFoundException when the leave type does not exist', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the leave type belongs to another organization', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);

      await expect(service.findOne('lt1', otherOrgUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const existing = { id: 'lt1', name: 'Annual', organizationId: 'org1' };

    it('updates and returns the leave type when no conflicts exist', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(existing);
      mockPrisma.leaveType.findFirst.mockResolvedValue(null);
      mockPrisma.leaveType.update.mockResolvedValue({
        ...existing,
        daysPerYear: 18,
      });

      const result = await service.update(
        'lt1',
        { daysPerYear: 18 },
        hrUser as any,
      );

      expect(mockPrisma.leaveType.update).toHaveBeenCalledWith({
        where: { id: 'lt1' },
        data: { daysPerYear: 18 },
      });
      expect(result).toEqual({ ...existing, daysPerYear: 18 });
    });

    it('throws ConflictException when another leave type has the same name', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(existing);
      mockPrisma.leaveType.findFirst.mockResolvedValue({
        id: 'lt2',
        name: 'Sick',
      });

      await expect(
        service.update('lt1', { name: 'Sick' }, hrUser as any),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.leaveType.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin tries to move it to a different org', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('lt1', { organizationId: 'org2' }, hrUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.leaveType.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    const leaveType = { id: 'lt1', organizationId: 'org1' };

    it('deletes and returns the leave type when unreferenced', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.count.mockResolvedValue(0);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);
      mockPrisma.leaveType.delete.mockResolvedValue(leaveType);

      const result = await service.remove('lt1', hrUser as any);

      expect(mockPrisma.leaveType.delete).toHaveBeenCalledWith({
        where: { id: 'lt1' },
      });
      expect(result).toEqual(leaveType);
    });

    it('throws ConflictException when balances reference it', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.count.mockResolvedValue(2);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);

      await expect(service.remove('lt1', hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveType.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when requests reference it', async () => {
      mockPrisma.leaveType.findUnique.mockResolvedValue(leaveType);
      mockPrisma.leaveBalance.count.mockResolvedValue(0);
      mockPrisma.leaveRequest.count.mockResolvedValue(1);

      await expect(service.remove('lt1', hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.leaveType.delete).not.toHaveBeenCalled();
    });
  });
});
