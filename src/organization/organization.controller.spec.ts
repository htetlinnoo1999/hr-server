import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

// Prevent Jest from loading the generated Prisma client (uses import.meta.url / ESM)
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findBySlug: jest.fn(),
  getEffectiveBranding: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('OrganizationController', () => {
  let controller: OrganizationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [{ provide: OrganizationService, useValue: mockService }],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  describe('create', () => {
    it('delegates to service.create with the provided dto', async () => {
      const dto = { name: 'Acme', slug: 'acme' };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll and returns the list', async () => {
      const orgs = [{ id: '1' }, { id: '2' }];
      mockService.findAll.mockResolvedValue(orgs);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalled();
      expect(result).toEqual(orgs);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the route id', async () => {
      const org = { id: 'abc' };
      mockService.findOne.mockResolvedValue(org);

      const result = await controller.findOne('abc');

      expect(mockService.findOne).toHaveBeenCalledWith('abc');
      expect(result).toEqual(org);
    });
  });

  describe('findBySlug', () => {
    it('delegates to service.findBySlug with the route slug', async () => {
      const org = { id: 'abc', slug: 'acme' };
      mockService.findBySlug.mockResolvedValue(org);

      const result = await controller.findBySlug('acme');

      expect(mockService.findBySlug).toHaveBeenCalledWith('acme');
      expect(result).toEqual(org);
    });
  });

  describe('getEffectiveBranding', () => {
    it('delegates to service.getEffectiveBranding with the route id', async () => {
      const branding = { id: 'abc', primaryColor: '#FF0000' };
      mockService.getEffectiveBranding.mockResolvedValue(branding);

      const result = await controller.getEffectiveBranding('abc');

      expect(mockService.getEffectiveBranding).toHaveBeenCalledWith('abc');
      expect(result).toEqual(branding);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id and dto', async () => {
      const dto = { name: 'Acme Corp' };
      const updated = { id: 'abc', name: 'Acme Corp', slug: 'acme' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('abc', dto);

      expect(mockService.update).toHaveBeenCalledWith('abc', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove with the route id', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('abc');

      expect(mockService.remove).toHaveBeenCalledWith('abc');
    });
  });
});
