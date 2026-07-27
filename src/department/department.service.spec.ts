import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentService } from './department.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  organization: {
    findUnique: jest.fn<any>(),
  },
  department: {
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
  },
  employee: {
    findUnique: jest.fn<any>(),
    count: jest.fn<any>(),
  },
};

const adminUser = {
  id: 'u-admin',
  email: 'admin@peoplify.app',
  role: 'ADMIN',
  organizationId: 'org1',
};
const ownUser = {
  id: 'u-own',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};
const otherUser = {
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

describe('DepartmentService', () => {
  let service: DepartmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = { organizationId: 'org1', name: 'Engineering' };
    const created = { id: '1', ...dto };

    it('creates and returns a department when the org exists and no conflicts', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue(created);

      const result = await service.create(dto as any, ownUser as any);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org1' },
      });
      expect(mockPrisma.department.create).toHaveBeenCalledWith({ data: dto });
      expect(result).toEqual(created);
    });

    it('throws ForbiddenException when a non-admin creates outside their own organization', async () => {
      await expect(
        service.create(dto as any, otherUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    it('allows an admin to create a department in any organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue(created);

      await service.create(dto as any, adminUser as any);

      expect(mockPrisma.department.create).toHaveBeenCalledWith({ data: dto });
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any, ownUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a department with this name already exists in the org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.department.findFirst.mockResolvedValue(created);

      await expect(service.create(dto as any, ownUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });

    describe('manager validation', () => {
      const dtoWithManager = { ...dto, managerId: 'emp1' };

      it('throws NotFoundException when the manager does not exist', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.department.findFirst.mockResolvedValueOnce(null);
        mockPrisma.employee.findUnique.mockResolvedValue(null);

        await expect(
          service.create(dtoWithManager as any, ownUser as any),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.department.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the manager belongs to a different organization', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.department.findFirst.mockResolvedValueOnce(null);
        mockPrisma.employee.findUnique.mockResolvedValue({
          id: 'emp1',
          organizationId: 'org2',
        });

        await expect(
          service.create(dtoWithManager as any, ownUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.department.create).not.toHaveBeenCalled();
      });

      it('throws ConflictException when the manager already manages another department', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.department.findFirst
          .mockResolvedValueOnce(null) // name conflict check
          .mockResolvedValueOnce({ id: 'other-dept', managerId: 'emp1' }); // manager assignment check
        mockPrisma.employee.findUnique.mockResolvedValue({
          id: 'emp1',
          organizationId: 'org1',
        });

        await expect(
          service.create(dtoWithManager as any, ownUser as any),
        ).rejects.toThrow(ConflictException);
        expect(mockPrisma.department.create).not.toHaveBeenCalled();
      });

      it('creates the department when the manager is valid', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.department.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        mockPrisma.employee.findUnique.mockResolvedValue({
          id: 'emp1',
          organizationId: 'org1',
        });
        mockPrisma.department.create.mockResolvedValue({
          id: '1',
          ...dtoWithManager,
        });

        const result = await service.create(
          dtoWithManager as any,
          ownUser as any,
        );

        expect(result).toEqual({ id: '1', ...dtoWithManager });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('scopes non-admins to their own organization, ignoring the query param', async () => {
      const departments = [{ id: '1' }];
      mockPrisma.department.findMany.mockResolvedValue(departments);
      mockPrisma.department.count.mockResolvedValue(1);

      const result = await service.findAll(ownUser as any, 'org2');

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: departments,
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('lets an admin list all departments when no organizationId filter is given', async () => {
      const departments = [{ id: '1' }, { id: '2' }];
      mockPrisma.department.findMany.mockResolvedValue(departments);
      mockPrisma.department.count.mockResolvedValue(2);

      const result = await service.findAll(adminUser as any);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: departments,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('computes skip from the requested page and limit', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.department.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, undefined, 2, 5);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 5,
        take: 5,
      });
    });

    it('throws ForbiddenException for a non-admin with no organization', async () => {
      await expect(service.findAll(orglessUser as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.department.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const department = {
      id: 'abc',
      name: 'Engineering',
      organizationId: 'org1',
    };

    it('returns the department when found within the caller organization', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(department);

      const result = await service.findOne('abc', ownUser as any);

      expect(mockPrisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(department);
    });

    it('throws NotFoundException when the department does not exist', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', ownUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the department belongs to another organization', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(department);

      await expect(service.findOne('abc', otherUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const existing = { id: 'abc', name: 'Engineering', organizationId: 'org1' };

    it('updates and returns the department when no conflicts exist', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(existing);
      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.update.mockResolvedValue({
        ...existing,
        name: 'Eng',
      });

      const result = await service.update(
        'abc',
        { name: 'Eng' },
        ownUser as any,
      );

      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { name: 'Eng' },
      });
      expect(result).toEqual({ ...existing, name: 'Eng' });
    });

    it('throws NotFoundException when department to update does not exist', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }, ownUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.department.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin updates a department from another organization', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { name: 'X' }, otherUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.department.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin tries to move the department to a different org', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { organizationId: 'org2' }, ownUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.department.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when another department has the same name in the org', async () => {
      const conflict = { id: 'xyz', name: 'Eng' };
      mockPrisma.department.findUnique.mockResolvedValue(existing);
      mockPrisma.department.findFirst.mockResolvedValue(conflict);

      await expect(
        service.update('abc', { name: 'Eng' }, ownUser as any),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.department.update).not.toHaveBeenCalled();
    });

    it('skips conflict check when name is not in the payload', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(existing);
      mockPrisma.department.update.mockResolvedValue({
        ...existing,
        description: 'New desc',
      });

      await service.update('abc', { description: 'New desc' }, ownUser as any);

      expect(mockPrisma.department.findFirst).not.toHaveBeenCalled();
    });

    it('re-validates the manager when managerId is included', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(existing);
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update('abc', { managerId: 'missing-emp' }, ownUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.department.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    const department = {
      id: 'abc',
      name: 'Engineering',
      organizationId: 'org1',
    };

    it('deletes and returns the department when it has no employees', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(department);
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.department.delete.mockResolvedValue(department);

      const result = await service.remove('abc', ownUser as any);

      expect(mockPrisma.employee.count).toHaveBeenCalledWith({
        where: { departmentId: 'abc' },
      });
      expect(mockPrisma.department.delete).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(department);
    });

    it('throws ConflictException when the department still has employees', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(department);
      mockPrisma.employee.count.mockResolvedValue(2);

      await expect(service.remove('abc', ownUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.department.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when department to delete does not exist', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', ownUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.department.delete).not.toHaveBeenCalled();
    });
  });
});
