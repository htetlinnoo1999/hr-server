import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from './organization.controller.ts';
import { OrganizationService } from './organization.service.ts';

const mockService = {
  create: jest.fn<any>(),
  findAll: jest.fn<any>(),
  findOne: jest.fn<any>(),
  findBySlug: jest.fn<any>(),
  getEffectiveBranding: jest.fn<any>(),
  update: jest.fn<any>(),
  remove: jest.fn<any>(),
};

const user = {
  id: 'u1',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'abc',
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
    it('delegates to service.findAll with the page and limit', async () => {
      const paginated = { data: [{ id: '1' }, { id: '2' }], total: 2, page: 1, limit: 20 };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(mockService.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(paginated);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the route id and current user', async () => {
      const org = { id: 'abc' };
      mockService.findOne.mockResolvedValue(org);

      const result = await controller.findOne('abc', user as any);

      expect(mockService.findOne).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(org);
    });
  });

  describe('findBySlug', () => {
    it('delegates to service.findBySlug with the route slug and current user', async () => {
      const org = { id: 'abc', slug: 'acme' };
      mockService.findBySlug.mockResolvedValue(org);

      const result = await controller.findBySlug('acme', user as any);

      expect(mockService.findBySlug).toHaveBeenCalledWith('acme', user);
      expect(result).toEqual(org);
    });
  });

  describe('getEffectiveBranding', () => {
    it('delegates to service.getEffectiveBranding with the route id and current user', async () => {
      const branding = { id: 'abc', primaryColor: '#FF0000' };
      mockService.getEffectiveBranding.mockResolvedValue(branding);

      const result = await controller.getEffectiveBranding('abc', user as any);

      expect(mockService.getEffectiveBranding).toHaveBeenCalledWith(
        'abc',
        user,
      );
      expect(result).toEqual(branding);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id, dto, and current user', async () => {
      const dto = { name: 'Acme Corp' };
      const updated = { id: 'abc', name: 'Acme Corp', slug: 'acme' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('abc', dto, user as any);

      expect(mockService.update).toHaveBeenCalledWith('abc', dto, user);
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
