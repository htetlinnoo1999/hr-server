import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) {
      throw new ConflictException('Organization with this name or slug already exists');
    }
    return this.prisma.organization.create({ data: dto });
  }

  findAll() {
    return this.prisma.organization.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new NotFoundException(`Organization '${slug}' not found`);
    return org;
  }

  /** Returns the organization's effective branding (falls back to default org when fields are absent). */
  async getEffectiveBranding(id: string) {
    const org = await this.findOne(id);
    if (org.primaryColor && org.secondaryColor && org.logo) {
      return org;
    }
    const defaultOrg = await this.prisma.organization.findFirst({ where: { isDefault: true } });
    return {
      ...org,
      primaryColor: org.primaryColor ?? defaultOrg?.primaryColor ?? null,
      secondaryColor: org.secondaryColor ?? defaultOrg?.secondaryColor ?? null,
      logo: org.logo ?? defaultOrg?.logo ?? null,
    };
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    if (dto.name || dto.slug) {
      const conflict = await this.prisma.organization.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: [dto.name ? { name: dto.name } : {}, dto.slug ? { slug: dto.slug } : {}] },
          ],
        },
      });
      if (conflict) {
        throw new ConflictException('Another organization with this name or slug already exists');
      }
    }
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.organization.delete({ where: { id } });
  }
}
