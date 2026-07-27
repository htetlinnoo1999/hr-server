import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { S3Service } from '../upload/s3.service.ts';

const mockS3 = {
  uploadFile: jest.fn<any>(),
};

const mockPrisma = {
  organization: {
    findUnique: jest.fn<any>(),
  },
  country: {
    findUnique: jest.fn<any>(),
  },
  department: {
    findUnique: jest.fn<any>(),
  },
  employee: {
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    count: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
  },
  employeeContract: {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
  },
  employeeDocument: {
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
  },
  leaveType: {
    findMany: jest.fn<any>(),
  },
  leaveBalance: {
    createMany: jest.fn<any>(),
  },
  $transaction: jest.fn<any>(),
};
mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
mockPrisma.leaveType.findMany.mockResolvedValue([]);
mockPrisma.country.findUnique.mockResolvedValue({ id: 'country1' });

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

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      organizationId: 'org1',
      employeeCode: 'EMP-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      salary: 1000,
      countryId: 'country1',
    };
    const created = { id: '1', ...dto };

    it('creates and returns an employee when the org exists and no conflicts', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue(created);

      const result = await service.create(dto as any, hrUser as any);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org1' },
      });
      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: { ...dto, role: 'EMPLOYEE', passwordHash: expect.any(String) },
      });
      expect(result).toEqual({
        ...created,
        temporaryPassword: expect.any(String),
      });
    });

    it('throws ForbiddenException when a non-admin tries to assign a role other than EMPLOYEE', async () => {
      await expect(
        service.create({ ...dto, role: 'ADMIN' } as any, hrUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    it('allows an admin to assign a non-default role', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue({
        ...created,
        role: 'HR_MANAGER',
      });

      await service.create(
        { ...dto, role: 'HR_MANAGER' } as any,
        adminUser as any,
      );

      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          role: 'HR_MANAGER',
          passwordHash: expect.any(String),
        },
      });
    });

    it("auto-provisions a leave balance for each of the org's leave types", async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue(created);
      mockPrisma.leaveType.findMany.mockResolvedValueOnce([
        { id: 'lt-annual', daysPerYear: 14, organizationId: 'org1' },
        { id: 'lt-sick', daysPerYear: 10, organizationId: 'org1' },
      ]);

      await service.create(dto as any, hrUser as any);

      expect(mockPrisma.leaveType.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
      });
      expect(mockPrisma.leaveBalance.createMany).toHaveBeenCalledWith({
        data: [
          {
            employeeId: '1',
            leaveTypeId: 'lt-annual',
            year: expect.any(Number),
            totalDays: 14,
            usedDays: 0,
            remainingDays: 14,
          },
          {
            employeeId: '1',
            leaveTypeId: 'lt-sick',
            year: expect.any(Number),
            totalDays: 10,
            usedDays: 0,
            remainingDays: 10,
          },
        ],
      });
    });

    it('skips leave balance creation when the org has no leave types', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue(created);
      mockPrisma.leaveType.findMany.mockResolvedValueOnce([]);

      await service.create(dto as any, hrUser as any);

      expect(mockPrisma.leaveBalance.createMany).not.toHaveBeenCalled();
    });

    it('passes employmentType through to prisma when provided', async () => {
      const dtoWithType = { ...dto, employmentType: 'CONTRACTOR' };
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue({ id: '1', ...dtoWithType });

      await service.create(dtoWithType as any, hrUser as any);

      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: {
          ...dtoWithType,
          role: 'EMPLOYEE',
          passwordHash: expect.any(String),
        },
      });
    });

    it('throws ForbiddenException when a non-admin creates outside their own organization', async () => {
      await expect(
        service.create(dto as any, otherOrgUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    it('allows an admin to create an employee in any organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue(created);

      await service.create(dto as any, adminUser as any);

      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: { ...dto, role: 'EMPLOYEE', passwordHash: expect.any(String) },
      });
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the country does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.country.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when code/email/identification already exists', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.employee.findFirst.mockResolvedValue(created);

      await expect(service.create(dto as any, hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    describe('manager validation', () => {
      const dtoWithManager = { ...dto, managerId: 'mgr1' };

      it('throws NotFoundException when the manager does not exist', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.employee.findUnique.mockResolvedValue(null);

        await expect(
          service.create(dtoWithManager as any, hrUser as any),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.employee.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the manager belongs to a different organization', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.employee.findUnique.mockResolvedValue({
          id: 'mgr1',
          organizationId: 'org2',
        });

        await expect(
          service.create(dtoWithManager as any, hrUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.employee.create).not.toHaveBeenCalled();
      });

      it('creates the employee when the manager is valid', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.employee.findUnique.mockResolvedValue({
          id: 'mgr1',
          organizationId: 'org1',
        });
        mockPrisma.employee.create.mockResolvedValue({
          id: '1',
          ...dtoWithManager,
        });

        const result = await service.create(
          dtoWithManager as any,
          hrUser as any,
        );

        expect(result).toEqual({
          id: '1',
          ...dtoWithManager,
          temporaryPassword: expect.any(String),
        });
      });
    });

    describe('department validation', () => {
      const dtoWithDept = { ...dto, departmentId: 'dept1' };

      it('throws NotFoundException when the department does not exist', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.department.findUnique.mockResolvedValue(null);

        await expect(
          service.create(dtoWithDept as any, hrUser as any),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.employee.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the department belongs to a different organization', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.department.findUnique.mockResolvedValue({
          id: 'dept1',
          organizationId: 'org2',
        });

        await expect(
          service.create(dtoWithDept as any, hrUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.employee.create).not.toHaveBeenCalled();
      });

      it('creates the employee when the department is valid', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
        mockPrisma.employee.findFirst.mockResolvedValue(null);
        mockPrisma.department.findUnique.mockResolvedValue({
          id: 'dept1',
          organizationId: 'org1',
        });
        mockPrisma.employee.create.mockResolvedValue({
          id: '1',
          ...dtoWithDept,
        });

        const result = await service.create(dtoWithDept as any, hrUser as any);

        expect(result).toEqual({
          id: '1',
          ...dtoWithDept,
          temporaryPassword: expect.any(String),
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('scopes non-admins to their own organization, ignoring the query param', async () => {
      const employees = [{ id: '1' }];
      mockPrisma.employee.findMany.mockResolvedValue(employees);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await service.findAll(hrUser as any, 'org2');

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
        omit: {
          phone: true,
          address: true,
          bankAccountNumber: true,
          salary: true,
        },
      });
      expect(mockPrisma.employee.count).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
      });
      expect(result).toEqual({ data: employees, total: 1, page: 1, limit: 20 });
    });

    it('lets an admin list all employees when no organizationId filter is given', async () => {
      const employees = [{ id: '1' }, { id: '2' }];
      mockPrisma.employee.findMany.mockResolvedValue(employees);
      mockPrisma.employee.count.mockResolvedValue(2);

      const result = await service.findAll(adminUser as any);

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
        omit: {
          phone: true,
          address: true,
          bankAccountNumber: true,
          salary: true,
        },
      });
      expect(result).toEqual({ data: employees, total: 2, page: 1, limit: 20 });
    });

    it('lets an admin filter by an explicit organizationId', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.employee.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, 'org2');

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org2' },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
        omit: {
          phone: true,
          address: true,
          bankAccountNumber: true,
          salary: true,
        },
      });
    });

    it('computes skip from the requested page and limit', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.employee.count.mockResolvedValue(0);

      await service.findAll(adminUser as any, undefined, 3, 10);

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
        skip: 20,
        take: 10,
        omit: {
          phone: true,
          address: true,
          bankAccountNumber: true,
          salary: true,
        },
      });
    });

    it('throws ForbiddenException for a non-admin with no organization', async () => {
      await expect(service.findAll(orglessUser as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // listOptions
  // ---------------------------------------------------------------------------
  describe('listOptions', () => {
    it("returns { id, name } pairs scoped to the caller's organization", async () => {
      const employees = [
        { id: '1', firstName: 'Jane', lastName: 'Doe' },
        { id: '2', firstName: 'John', lastName: 'Smith' },
      ];
      mockPrisma.employee.findMany.mockResolvedValue(employees);

      const result = await service.listOptions(hrUser as any);

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true },
      });
      expect(result).toEqual([
        { id: '1', name: 'Jane Doe' },
        { id: '2', name: 'John Smith' },
      ]);
    });

    it('throws ForbiddenException when the caller has no organization', async () => {
      await expect(service.listOptions(orglessUser as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const employee = { id: 'abc', firstName: 'Jane', organizationId: 'org1' };

    it('returns the employee when found within the caller organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      const result = await service.findOne('abc', hrUser as any);

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(employee);
    });

    it('lets an admin fetch an employee from any organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      const result = await service.findOne('abc', adminUser as any);

      expect(result).toEqual(employee);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the employee belongs to another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(service.findOne('abc', otherOrgUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getProfile
  // ---------------------------------------------------------------------------
  describe('getProfile', () => {
    const employee = {
      id: 'abc',
      organizationId: 'org1',
      organization: { id: 'org1', name: 'Acme' },
      leaveBalances: [
        { id: 'lb1', totalDays: 14, usedDays: 2, remainingDays: 12 },
      ],
      leaveRequests: [{ id: 'lr1', status: 'APPROVED' }],
    };

    it('returns the employee with organization, leave balances, and recent leave requests', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      const result = await service.getProfile('abc', hrUser as any);

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
        include: {
          organization: true,
          leaveBalances: {
            where: { year: expect.any(Number) },
            include: { leaveType: { select: { id: true, name: true } } },
          },
          leaveRequests: {
            where: { status: 'APPROVED' },
            orderBy: { startDate: 'desc' },
            take: 5,
            include: { leaveType: { select: { id: true, name: true } } },
          },
        },
      });
      expect(result).toEqual(employee);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.getProfile('missing', hrUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when a non-admin requests an employee from another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(
        service.getProfile('abc', otherOrgUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const existing = {
      id: 'abc',
      firstName: 'Jane',
      employeeCode: 'EMP-1',
      organizationId: 'org1',
    };

    it('updates and returns the employee when no conflicts exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(existing);
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.employee.update.mockResolvedValue({
        ...existing,
        firstName: 'Janet',
      });

      const result = await service.update(
        'abc',
        { firstName: 'Janet' },
        hrUser as any,
      );

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { firstName: 'Janet' },
      });
      expect(result).toEqual({ ...existing, firstName: 'Janet' });
    });

    it('throws NotFoundException when employee to update does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'X' }, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin updates an employee from another organization', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { firstName: 'X' }, otherOrgUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin tries to move the employee to a different org', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { organizationId: 'org2' }, hrUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when another employee has the same unique fields', async () => {
      const conflict = { id: 'xyz', employeeCode: 'EMP-1' };
      mockPrisma.employee.findUnique.mockResolvedValue(existing);
      mockPrisma.employee.findFirst.mockResolvedValue(conflict);

      await expect(
        service.update('abc', { employeeCode: 'EMP-1' }, hrUser as any),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });

    it('skips conflict check when no unique fields are in the payload', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(existing);
      mockPrisma.employee.update.mockResolvedValue({
        ...existing,
        phone: '123',
      });

      await service.update('abc', { phone: '123' }, hrUser as any);

      expect(mockPrisma.employee.findFirst).not.toHaveBeenCalled();
    });

    describe('country validation', () => {
      it('throws NotFoundException when the new country does not exist', async () => {
        mockPrisma.employee.findUnique.mockResolvedValue(existing);
        mockPrisma.country.findUnique.mockResolvedValueOnce(null);

        await expect(
          service.update(
            'abc',
            { countryId: 'missing-country' },
            hrUser as any,
          ),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('updates the employee when the country is valid', async () => {
        mockPrisma.employee.findUnique.mockResolvedValue(existing);
        mockPrisma.country.findUnique.mockResolvedValueOnce({
          id: 'country2',
        });
        mockPrisma.employee.update.mockResolvedValue({
          ...existing,
          countryId: 'country2',
        });

        const result = await service.update(
          'abc',
          { countryId: 'country2' },
          hrUser as any,
        );

        expect(result).toEqual({ ...existing, countryId: 'country2' });
      });
    });

    describe('manager validation', () => {
      it('throws NotFoundException when the manager does not exist', async () => {
        mockPrisma.employee.findUnique
          .mockResolvedValueOnce(existing) // findOne lookup
          .mockResolvedValueOnce(null); // manager lookup

        await expect(
          service.update('abc', { managerId: 'missing-mgr' }, hrUser as any),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the manager belongs to a different organization', async () => {
        mockPrisma.employee.findUnique
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce({ id: 'mgr1', organizationId: 'org2' });

        await expect(
          service.update('abc', { managerId: 'mgr1' }, hrUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when an employee is set as their own manager', async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(existing);

        await expect(
          service.update('abc', { managerId: 'abc' }, hrUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('updates the employee when the manager is valid', async () => {
        mockPrisma.employee.findUnique
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce({ id: 'mgr1', organizationId: 'org1' });
        mockPrisma.employee.update.mockResolvedValue({
          ...existing,
          managerId: 'mgr1',
        });

        const result = await service.update(
          'abc',
          { managerId: 'mgr1' },
          hrUser as any,
        );

        expect(result).toEqual({ ...existing, managerId: 'mgr1' });
      });
    });

    describe('department validation', () => {
      it('throws NotFoundException when the department does not exist', async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(existing);
        mockPrisma.department.findUnique.mockResolvedValue(null);

        await expect(
          service.update(
            'abc',
            { departmentId: 'missing-dept' },
            hrUser as any,
          ),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the department belongs to a different organization', async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(existing);
        mockPrisma.department.findUnique.mockResolvedValue({
          id: 'dept1',
          organizationId: 'org2',
        });

        await expect(
          service.update('abc', { departmentId: 'dept1' }, hrUser as any),
        ).rejects.toThrow(BadRequestException);
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      });

      it('updates the employee when the department is valid', async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(existing);
        mockPrisma.department.findUnique.mockResolvedValue({
          id: 'dept1',
          organizationId: 'org1',
        });
        mockPrisma.employee.update.mockResolvedValue({
          ...existing,
          departmentId: 'dept1',
        });

        const result = await service.update(
          'abc',
          { departmentId: 'dept1' },
          hrUser as any,
        );

        expect(result).toEqual({ ...existing, departmentId: 'dept1' });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateOwnProfile
  // ---------------------------------------------------------------------------
  describe('updateOwnProfile', () => {
    const employee = { id: 'u-hr', organizationId: 'org1' };

    it('updates the nickname for the linked employee', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.employee.update.mockResolvedValue({
        ...employee,
        nickname: 'Janie',
      });

      const result = await service.updateOwnProfile(
        hrUser as any,
        { nickname: 'Janie' },
        undefined,
      );

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'u-hr' },
      });
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'u-hr' },
        data: { nickname: 'Janie' },
      });
      expect(result).toEqual({ ...employee, nickname: 'Janie' });
      expect(mockS3.uploadFile).not.toHaveBeenCalled();
    });

    it('uploads the file to S3 and stores the returned URL as profilePicture', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockS3.uploadFile.mockResolvedValue(
        'https://bucket.s3.amazonaws.com/key.png',
      );
      mockPrisma.employee.update.mockResolvedValue({
        ...employee,
        profilePicture: 'https://bucket.s3.amazonaws.com/key.png',
      });
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        originalname: 'pic.png',
      };

      const result = await service.updateOwnProfile(
        hrUser as any,
        {},
        file as any,
      );

      expect(mockS3.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        expect.stringContaining('employees/u-hr/profile-picture-'),
        'image/png',
      );
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'u-hr' },
        data: { profilePicture: 'https://bucket.s3.amazonaws.com/key.png' },
      });
      expect(result.profilePicture).toBe(
        'https://bucket.s3.amazonaws.com/key.png',
      );
    });

    it('throws NotFoundException when the caller has no linked employee record', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOwnProfile(hrUser as any, { nickname: 'X' }, undefined),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes and returns the employee when status is INACTIVE', async () => {
      const employee = {
        id: 'abc',
        organizationId: 'org1',
        status: 'INACTIVE',
      };
      mockPrisma.employee.findUnique.mockResolvedValue(employee);
      mockPrisma.employee.delete.mockResolvedValue(employee);

      const result = await service.remove('abc', hrUser as any);

      expect(mockPrisma.employee.delete).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(employee);
    });

    it('throws ConflictException when the employee is not INACTIVE', async () => {
      const employee = { id: 'abc', organizationId: 'org1', status: 'ACTIVE' };
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(service.remove('abc', hrUser as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.employee.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when employee to delete does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', hrUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.employee.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin deletes an employee from another organization', async () => {
      const employee = {
        id: 'abc',
        organizationId: 'org1',
        status: 'INACTIVE',
      };
      mockPrisma.employee.findUnique.mockResolvedValue(employee);

      await expect(service.remove('abc', otherOrgUser as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.employee.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // contracts
  // ---------------------------------------------------------------------------
  describe('addContract', () => {
    const dto = { contractType: 'PERMANENT', startDate: '2024-01-15' };

    it('creates a contract for an existing employee, converting startDate to a Date', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'abc',
        organizationId: 'org1',
      });
      const created = { id: 'c1', employeeId: 'abc', ...dto };
      mockPrisma.employeeContract.create.mockResolvedValue(created);

      const result = await service.addContract(
        'abc',
        dto as any,
        hrUser as any,
      );

      expect(mockPrisma.employeeContract.create).toHaveBeenCalledWith({
        data: { ...dto, employeeId: 'abc', startDate: new Date(dto.startDate) },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.addContract('missing', dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.employeeContract.create).not.toHaveBeenCalled();
    });
  });

  describe('listContracts', () => {
    it('returns contracts ordered by startDate desc', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'abc',
        organizationId: 'org1',
      });
      const contracts = [{ id: 'c1' }];
      mockPrisma.employeeContract.findMany.mockResolvedValue(contracts);

      const result = await service.listContracts('abc', hrUser as any);

      expect(mockPrisma.employeeContract.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'abc' },
        orderBy: { startDate: 'desc' },
      });
      expect(result).toEqual(contracts);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.listContracts('missing', hrUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // documents
  // ---------------------------------------------------------------------------
  describe('addDocument', () => {
    const dto = {
      documentType: 'Certificate',
      fileUrl: 'https://example.com/doc.pdf',
    };

    it('creates a document for an existing employee', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'abc',
        organizationId: 'org1',
      });
      const created = { id: 'd1', employeeId: 'abc', ...dto };
      mockPrisma.employeeDocument.create.mockResolvedValue(created);

      const result = await service.addDocument(
        'abc',
        dto as any,
        hrUser as any,
      );

      expect(mockPrisma.employeeDocument.create).toHaveBeenCalledWith({
        data: { ...dto, employeeId: 'abc' },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.addDocument('missing', dto as any, hrUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.employeeDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('listDocuments', () => {
    it('returns documents ordered by uploadedAt desc', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'abc',
        organizationId: 'org1',
      });
      const documents = [{ id: 'd1' }];
      mockPrisma.employeeDocument.findMany.mockResolvedValue(documents);

      const result = await service.listDocuments('abc', hrUser as any);

      expect(mockPrisma.employeeDocument.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'abc' },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(result).toEqual(documents);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.listDocuments('missing', hrUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
