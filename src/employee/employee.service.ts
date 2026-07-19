import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateEmployeeDto } from './dto/create-employee.dto.ts';
import { UpdateEmployeeDto } from './dto/update-employee.dto.ts';
import { CreateEmployeeContractDto } from './dto/create-employee-contract.dto.ts';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto.ts';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role, EmploymentStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  private toEmployeeData<T extends { dateOfBirth?: string; hireDate?: string }>(
    dto: T,
  ) {
    return {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
    };
  }

  /** Non-admins are confined to their own organization; a null org means no access at all. */
  private assertOrgAccess(
    employee: { id: string; organizationId: string },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== Role.ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new NotFoundException(`Employee ${employee.id} not found`);
    }
  }

  /** A manager must be a real employee in the same organization, and not the employee itself. */
  private async assertValidManager(
    managerId: string,
    organizationId: string,
    employeeId?: string,
  ) {
    if (managerId === employeeId) {
      throw new BadRequestException('An employee cannot be their own manager');
    }
    const manager = await this.prisma.employee.findUnique({
      where: { id: managerId },
    });
    if (!manager) {
      throw new NotFoundException(`Manager ${managerId} not found`);
    }
    if (manager.organizationId !== organizationId) {
      throw new BadRequestException(
        'Manager must belong to the same organization',
      );
    }
  }

  /** A department must be a real department in the same organization. */
  private async assertValidDepartment(
    departmentId: string,
    organizationId: string,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department ${departmentId} not found`);
    }
    if (department.organizationId !== organizationId) {
      throw new BadRequestException(
        'Department must belong to the same organization',
      );
    }
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    if (
      user.role !== Role.ADMIN &&
      dto.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You can only create employees in your own organization',
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new NotFoundException(
        `Organization ${dto.organizationId} not found`,
      );
    }

    const existing = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { employeeCode: dto.employeeCode },
          { email: dto.email },
          ...(dto.identificationNumber
            ? [{ identificationNumber: dto.identificationNumber }]
            : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException(
        'Employee with this code, email, or identification number already exists',
      );
    }

    if (dto.managerId) {
      await this.assertValidManager(dto.managerId, dto.organizationId);
    }

    if (dto.departmentId) {
      await this.assertValidDepartment(dto.departmentId, dto.organizationId);
    }

    return this.prisma.employee.create({ data: this.toEmployeeData(dto) });
  }

  findAll(user: AuthenticatedUser, organizationId?: string) {
    if (user.role !== Role.ADMIN && !user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    const scopedOrgId =
      user.role === Role.ADMIN ? organizationId : user.organizationId;

    return this.prisma.employee.findMany({
      where: scopedOrgId ? { organizationId: scopedOrgId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    this.assertOrgAccess(employee, user);
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthenticatedUser) {
    const employee = await this.findOne(id, user);

    if (
      dto.organizationId &&
      dto.organizationId !== employee.organizationId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Cannot move an employee to a different organization',
      );
    }

    if (dto.employeeCode || dto.email || dto.identificationNumber) {
      const conflict = await this.prisma.employee.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                dto.employeeCode ? { employeeCode: dto.employeeCode } : {},
                dto.email ? { email: dto.email } : {},
                dto.identificationNumber
                  ? { identificationNumber: dto.identificationNumber }
                  : {},
              ],
            },
          ],
        },
      });
      if (conflict) {
        throw new ConflictException(
          'Another employee with this code, email, or identification number already exists',
        );
      }
    }

    if (dto.managerId) {
      const targetOrgId = dto.organizationId ?? employee.organizationId;
      await this.assertValidManager(dto.managerId, targetOrgId, id);
    }

    if (dto.departmentId) {
      const targetOrgId = dto.organizationId ?? employee.organizationId;
      await this.assertValidDepartment(dto.departmentId, targetOrgId);
    }

    return this.prisma.employee.update({
      where: { id },
      data: this.toEmployeeData(dto),
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const employee = await this.findOne(id, user);
    if (employee.status !== EmploymentStatus.INACTIVE) {
      throw new ConflictException('Only inactive employees can be deleted');
    }
    return this.prisma.employee.delete({ where: { id } });
  }

  async addContract(
    employeeId: string,
    dto: CreateEmployeeContractDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeContract.create({
      data: {
        ...dto,
        employeeId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async listContracts(employeeId: string, user: AuthenticatedUser) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeContract.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async addDocument(
    employeeId: string,
    dto: CreateEmployeeDocumentDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeDocument.create({
      data: { ...dto, employeeId },
    });
  }

  async listDocuments(employeeId: string, user: AuthenticatedUser) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}
