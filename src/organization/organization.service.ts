import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CreateOrganizationDto } from './dto/create-organization.dto.ts';
import { UpdateOrganizationDto } from './dto/update-organization.dto.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role, Gender } from '../../generated/prisma/enums.js';

/** Seeded for every new organization; HR can edit these afterward (no separate create endpoint). */
const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual', daysPerYear: 14 },
  { name: 'Sick', daysPerYear: 10 },
  { name: 'Maternal', daysPerYear: 90, restrictedGender: Gender.FEMALE },
  { name: 'Paternal', daysPerYear: 14, restrictedGender: Gender.MALE },
];

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-admins are confined to their own organization; everyone else 404s, hiding whether it exists. */
  private assertOwnOrg(org: { id: string }, user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN && org.id !== user.organizationId) {
      throw new NotFoundException(`Organization ${org.id} not found`);
    }
  }

  async create(dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException(
        'Organization with this name or slug already exists',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: dto });
      await tx.leaveType.createMany({
        data: DEFAULT_LEAVE_TYPES.map((leaveType) => ({
          ...leaveType,
          organizationId: org.id,
        })),
      });
      return org;
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.organization.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { leaveTypes: true },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    this.assertOwnOrg(org, user);
    return org;
  }

  async findBySlug(slug: string, user: AuthenticatedUser) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: { leaveTypes: true },
    });
    if (!org) throw new NotFoundException(`Organization '${slug}' not found`);
    this.assertOwnOrg(org, user);
    return org;
  }

  /** Returns the organization's effective branding (falls back to default org when fields are absent). */
  async getEffectiveBranding(id: string, user: AuthenticatedUser) {
    const org = await this.findOne(id, user);
    if (org.primaryColor && org.secondaryColor && org.logo) {
      return org;
    }
    const defaultOrg = await this.prisma.organization.findFirst({
      where: { isDefault: true },
    });
    return {
      ...org,
      primaryColor: org.primaryColor ?? defaultOrg?.primaryColor ?? null,
      secondaryColor: org.secondaryColor ?? defaultOrg?.secondaryColor ?? null,
      logo: org.logo ?? defaultOrg?.logo ?? null,
    };
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(id, user);

    if (dto.isDefault !== undefined && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an admin can change the default organization',
      );
    }

    if (dto.name || dto.slug) {
      const conflict = await this.prisma.organization.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                dto.name ? { name: dto.name } : {},
                dto.slug ? { slug: dto.slug } : {},
              ],
            },
          ],
        },
      });
      if (conflict) {
        throw new ConflictException(
          'Another organization with this name or slug already exists',
        );
      }
    }
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    const employeeCount = await this.prisma.employee.count({
      where: { organizationId: id },
    });
    if (employeeCount > 0) {
      throw new ConflictException(
        'Cannot delete organization with existing employees',
      );
    }
    return this.prisma.organization.delete({ where: { id } });
  }
}
