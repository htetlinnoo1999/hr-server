import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateEmployeeDto } from './dto/create-employee.dto.ts';
import { UpdateEmployeeDto } from './dto/update-employee.dto.ts';
import { CreateEmployeeContractDto } from './dto/create-employee-contract.dto.ts';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto.ts';
import { CreateEmployeeAllowanceDto } from './dto/create-employee-allowance.dto.ts';
import { UpdateEmployeeAllowanceDto } from './dto/update-employee-allowance.dto.ts';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.ts';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import {
  Role,
  EmploymentStatus,
  LeaveStatus,
} from '../../generated/prisma/enums.js';
import { S3Service } from '../upload/s3.service.ts';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  private toEmployeeData<
    T extends { dateOfBirth?: string; hireDate?: string; visaEndDate?: string },
  >(dto: T) {
    return {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      visaEndDate: dto.visaEndDate ? new Date(dto.visaEndDate) : undefined,
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

  private generateTemporaryPassword(): string {
    return randomBytes(9).toString('base64url');
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

  /** An end client must be a real end client in the same organization. */
  private async assertValidEndClient(
    endClientId: string,
    organizationId: string,
  ) {
    const endClient = await this.prisma.endClient.findUnique({
      where: { id: endClientId },
    });
    if (!endClient) {
      throw new NotFoundException(`End client ${endClientId} not found`);
    }
    if (endClient.organizationId !== organizationId) {
      throw new BadRequestException(
        'End client must belong to the same organization',
      );
    }
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    const organizationId = user.organizationId;

    if (dto.role && dto.role !== Role.EMPLOYEE && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an admin can assign a role other than EMPLOYEE',
      );
    }

    const country = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country ${dto.countryId} not found`);
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
      await this.assertValidManager(dto.managerId, organizationId);
    }

    if (dto.departmentId) {
      await this.assertValidDepartment(dto.departmentId, organizationId);
    }

    if (dto.endClientId) {
      await this.assertValidEndClient(dto.endClientId, organizationId);
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const employee = await this.prisma.employee.create({
      data: {
        ...this.toEmployeeData(dto),
        organizationId,
        role: dto.role ?? Role.EMPLOYEE,
        passwordHash,
      },
    });
    return { ...employee, temporaryPassword };
  }

  async findAll(
    user: AuthenticatedUser,
    organizationId?: string,
    page = 1,
    limit = 20,
  ) {
    if (user.role !== Role.ADMIN && !user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }
    const scopedOrgId =
      user.role === Role.ADMIN ? organizationId : user.organizationId;
    const where = scopedOrgId ? { organizationId: scopedOrgId } : undefined;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        omit: {
          phone: true,
          address: true,
          bankAccountNumber: true,
          salary: true,
        },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /** Lightweight { id, name } list of the caller's own organization, for dropdown use. */
  async listOptions(user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    });

    return employees.map((employee) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
    }));
  }

  /**
   * Cumulative headcount at the end of each month of `year`, counting employees
   * hired on or before that month end. Departures aren't tracked with a date
   * (only a current `status`), so this reflects hires-to-date rather than
   * factoring in attrition.
   */
  async getMonthlyHeadcount(user: AuthenticatedUser, year: number) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'User is not associated with an organization',
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: user.organizationId,
        hireDate: { lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { hireDate: true },
    });

    return Array.from({ length: 12 }, (_, i) => {
      const monthEnd = new Date(Date.UTC(year, i + 1, 1));
      const count = employees.filter((e) => e.hireDate < monthEnd).length;
      return { month: i + 1, count };
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    this.assertOrgAccess(employee, user);
    return employee;
  }

  /**
   * Full profile view: the employee plus their organization, this year's leave
   * balances (days used/remaining per leave type), and their 5 most recent
   * approved leave requests.
   */
  async getProfile(id: string, user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        organization: true,
        leaveBalances: {
          where: { year: new Date().getFullYear() },
          include: { leaveType: { select: { id: true, name: true } } },
        },
        leaveRequests: {
          where: { status: LeaveStatus.APPROVED },
          orderBy: { startDate: 'desc' },
          take: 5,
          include: { leaveType: { select: { id: true, name: true } } },
        },
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    this.assertOrgAccess(employee, user);
    return employee;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthenticatedUser,
    file?: Express.Multer.File,
  ) {
    const employee = await this.findOne(id, user);

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
      await this.assertValidManager(dto.managerId, employee.organizationId, id);
    }

    if (dto.departmentId) {
      await this.assertValidDepartment(
        dto.departmentId,
        employee.organizationId,
      );
    }

    if (dto.endClientId) {
      await this.assertValidEndClient(dto.endClientId, employee.organizationId);
    }

    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });
      if (!country) {
        throw new NotFoundException(`Country ${dto.countryId} not found`);
      }
    }

    let profilePicture: string | undefined;
    if (file) {
      const extension = file.originalname.split('.').pop() ?? 'jpg';
      const key = `employees/${id}/profile-picture-${Date.now()}.${extension}`;
      profilePicture = await this.s3.uploadFile(
        file.buffer,
        key,
        file.mimetype,
      );
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...this.toEmployeeData(dto),
        ...(profilePicture !== undefined ? { profilePicture } : {}),
      },
    });
  }

  async updateOwnProfile(
    user: AuthenticatedUser,
    dto: UpdateMyProfileDto,
    file?: Express.Multer.File,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: user.id },
    });
    if (!employee) {
      throw new NotFoundException('No employee profile linked to this account');
    }

    let profilePicture: string | undefined;
    if (file) {
      const extension = file.originalname.split('.').pop() ?? 'jpg';
      const key = `employees/${employee.id}/profile-picture-${Date.now()}.${extension}`;
      profilePicture = await this.s3.uploadFile(
        file.buffer,
        key,
        file.mimetype,
      );
    }

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(profilePicture !== undefined ? { profilePicture } : {}),
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const employee = await this.findOne(id, user);
    if (
      employee.status !== EmploymentStatus.INACTIVE &&
      employee.status !== EmploymentStatus.TERMINATED
    ) {
      throw new ConflictException(
        'Only inactive or terminated employees can be deleted',
      );
    }
    return this.prisma.employee.delete({ where: { id } });
  }

  /** Uploads a file to S3 under `employees/{employeeId}/{folder}/{timestamp}.{ext}`. */
  private async uploadEmployeeFile(
    employeeId: string,
    folder: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const extension = file.originalname.split('.').pop() ?? 'bin';
    const key = `employees/${employeeId}/${folder}/${Date.now()}.${extension}`;
    return this.s3.uploadFile(file.buffer, key, file.mimetype);
  }

  async addContract(
    employeeId: string,
    dto: CreateEmployeeContractDto,
    user: AuthenticatedUser,
    file?: Express.Multer.File,
  ) {
    await this.findOne(employeeId, user);
    const fileUrl = file
      ? await this.uploadEmployeeFile(employeeId, 'contracts', file)
      : dto.fileUrl;
    return this.prisma.employeeContract.create({
      data: {
        ...dto,
        employeeId,
        fileUrl,
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
    file?: Express.Multer.File,
  ) {
    await this.findOne(employeeId, user);
    const fileUrl = file
      ? await this.uploadEmployeeFile(employeeId, 'documents', file)
      : dto.fileUrl;
    if (!fileUrl) {
      throw new BadRequestException(
        'Either a file upload or fileUrl is required',
      );
    }
    return this.prisma.employeeDocument.create({
      data: { ...dto, employeeId, fileUrl },
    });
  }

  async listDocuments(employeeId: string, user: AuthenticatedUser) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async addAllowance(
    employeeId: string,
    dto: CreateEmployeeAllowanceDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeAllowance.create({
      data: { ...dto, employeeId },
    });
  }

  async listAllowances(employeeId: string, user: AuthenticatedUser) {
    await this.findOne(employeeId, user);
    return this.prisma.employeeAllowance.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Fetches an allowance, enforcing both org access and that it belongs to the given employee. */
  private async findAllowance(
    employeeId: string,
    allowanceId: string,
    user: AuthenticatedUser,
  ) {
    await this.findOne(employeeId, user);
    const allowance = await this.prisma.employeeAllowance.findUnique({
      where: { id: allowanceId },
    });
    if (!allowance || allowance.employeeId !== employeeId) {
      throw new NotFoundException(`Allowance ${allowanceId} not found`);
    }
    return allowance;
  }

  async updateAllowance(
    employeeId: string,
    allowanceId: string,
    dto: UpdateEmployeeAllowanceDto,
    user: AuthenticatedUser,
  ) {
    await this.findAllowance(employeeId, allowanceId, user);
    return this.prisma.employeeAllowance.update({
      where: { id: allowanceId },
      data: dto,
    });
  }

  async removeAllowance(
    employeeId: string,
    allowanceId: string,
    user: AuthenticatedUser,
  ) {
    await this.findAllowance(employeeId, allowanceId, user);
    return this.prisma.employeeAllowance.delete({ where: { id: allowanceId } });
  }
}
