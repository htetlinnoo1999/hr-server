import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  organization: {
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
  },
  employee: {
    count: jest.fn<any>(),
  },
};

const adminUser = {
  id: 'u-admin',
  email: 'admin@peoplify.app',
  role: 'ADMIN',
  organizationId: 'abc',
};
const ownUser = {
  id: 'u-own',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'abc',
};
const otherUser = {
  id: 'u-other',
  email: 'hr@other.com',
  role: 'HR_MANAGER',
  organizationId: 'xyz',
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const dto = { name: 'Acme', slug: 'acme' };
    const created = {
      id: '1',
      ...dto,
      primaryColor: null,
      secondaryColor: null,
      logo: null,
      isDefault: false,
      createdAt: new Date(),
    };

    it('creates and returns an organization when name/slug are unique', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
      });
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(result).toEqual(created);
    });

    it('throws ConflictException when name or slug already exists', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(created);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('returns all organizations ordered by createdAt asc', async () => {
      const orgs = [{ id: '1' }, { id: '2' }];
      mockPrisma.organization.findMany.mockResolvedValue(orgs);

      const result = await service.findAll();

      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(orgs);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    const org = { id: 'abc', name: 'Acme', slug: 'acme' };

    it('returns the organization when it is the caller own org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      const result = await service.findOne('abc', ownUser as any);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(org);
    });

    it('lets an admin fetch any organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      const result = await service.findOne('abc', adminUser as any);

      expect(result).toEqual(org);
    });

    it('throws NotFoundException when organization does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', ownUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when a non-admin requests another organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      await expect(service.findOne('abc', otherUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findBySlug
  // ---------------------------------------------------------------------------
  describe('findBySlug', () => {
    const org = { id: 'abc', name: 'Acme', slug: 'acme' };

    it('returns the organization when slug matches the caller own org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      const result = await service.findBySlug('acme', ownUser as any);

      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'acme' },
      });
      expect(result).toEqual(org);
    });

    it('throws NotFoundException when slug is not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.findBySlug('unknown', ownUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when a non-admin requests another organization by slug', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      await expect(
        service.findBySlug('acme', otherUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getEffectiveBranding
  // ---------------------------------------------------------------------------
  describe('getEffectiveBranding', () => {
    const fullOrg = {
      id: 'abc',
      name: 'Acme',
      slug: 'acme',
      primaryColor: '#FF0000',
      secondaryColor: '#00FF00',
      logo: 'https://example.com/logo.png',
      isDefault: false,
    };

    it('returns the org as-is when all branding fields are present', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(fullOrg);

      const result = await service.getEffectiveBranding('abc', ownUser as any);

      expect(result).toEqual(fullOrg);
      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });

    it('merges missing fields from the default org', async () => {
      const partialOrg = { ...fullOrg, secondaryColor: null, logo: null };
      const defaultOrg = {
        id: 'def',
        name: 'Default',
        slug: 'default',
        primaryColor: '#111111',
        secondaryColor: '#222222',
        logo: 'https://default.com/logo.png',
        isDefault: true,
      };
      mockPrisma.organization.findUnique.mockResolvedValue(partialOrg);
      mockPrisma.organization.findFirst.mockResolvedValue(defaultOrg);

      const result = await service.getEffectiveBranding('abc', ownUser as any);

      expect(result.primaryColor).toBe(partialOrg.primaryColor);
      expect(result.secondaryColor).toBe(defaultOrg.secondaryColor);
      expect(result.logo).toBe(defaultOrg.logo);
    });

    it('uses null when no default org exists and branding fields are missing', async () => {
      const partialOrg = {
        ...fullOrg,
        primaryColor: null,
        secondaryColor: null,
        logo: null,
      };
      mockPrisma.organization.findUnique.mockResolvedValue(partialOrg);
      mockPrisma.organization.findFirst.mockResolvedValue(null);

      const result = await service.getEffectiveBranding('abc', ownUser as any);

      expect(result.primaryColor).toBeNull();
      expect(result.secondaryColor).toBeNull();
      expect(result.logo).toBeNull();
    });

    it('throws NotFoundException when the org does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getEffectiveBranding('missing', ownUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when a non-admin requests branding for another org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(fullOrg);

      await expect(
        service.getEffectiveBranding('abc', otherUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const existing = { id: 'abc', name: 'Acme', slug: 'acme' };
    const updated = { ...existing, name: 'Acme Corp' };

    it('updates and returns the organization when no conflicts exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(existing);
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue(updated);

      const result = await service.update(
        'abc',
        { name: 'Acme Corp' },
        ownUser as any,
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { name: 'Acme Corp' },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when organization to update does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }, ownUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a non-admin updates another organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { name: 'X' }, otherUser as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a non-admin tries to change isDefault', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(existing);

      await expect(
        service.update('abc', { isDefault: true }, ownUser as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('allows an admin to change isDefault', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(existing);
      mockPrisma.organization.update.mockResolvedValue({
        ...existing,
        isDefault: true,
      });

      await service.update('abc', { isDefault: true }, adminUser as any);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { isDefault: true },
      });
    });

    it('throws ConflictException when another org has the same name or slug', async () => {
      const conflict = { id: 'xyz', name: 'Acme Corp', slug: 'acme-corp' };
      mockPrisma.organization.findUnique.mockResolvedValue(existing);
      mockPrisma.organization.findFirst.mockResolvedValue(conflict);

      await expect(
        service.update('abc', { name: 'Acme Corp' }, ownUser as any),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('skips conflict check when neither name nor slug is in the payload', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(existing);
      mockPrisma.organization.update.mockResolvedValue({
        ...existing,
        logo: 'https://new.com/logo.png',
      });

      await service.update(
        'abc',
        { logo: 'https://new.com/logo.png' },
        ownUser as any,
      );

      expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    const org = { id: 'abc', name: 'Acme', slug: 'acme' };

    it('deletes and returns the organization when it has no employees', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);
      mockPrisma.employee.count.mockResolvedValue(0);
      mockPrisma.organization.delete.mockResolvedValue(org);

      const result = await service.remove('abc');

      expect(mockPrisma.employee.count).toHaveBeenCalledWith({
        where: { organizationId: 'abc' },
      });
      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
      expect(result).toEqual(org);
    });

    it('throws NotFoundException when organization to delete does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the organization still has employees', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(org);
      mockPrisma.employee.count.mockResolvedValue(3);

      await expect(service.remove('abc')).rejects.toThrow(ConflictException);
      expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
    });
  });
});
