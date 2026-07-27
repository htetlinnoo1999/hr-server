import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller.ts';
import { DepartmentService } from './department.service.ts';

const mockService = {
  create: jest.fn<any>(),
  findAll: jest.fn<any>(),
  findOne: jest.fn<any>(),
  update: jest.fn<any>(),
  remove: jest.fn<any>(),
};

const user = {
  id: 'u1',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};

describe('DepartmentController', () => {
  let controller: DepartmentController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [{ provide: DepartmentService, useValue: mockService }],
    }).compile();

    controller = module.get<DepartmentController>(DepartmentController);
  });

  describe('create', () => {
    it('delegates to service.create with the provided dto and current user', async () => {
      const dto = { organizationId: 'org1', name: 'Engineering' };
      const created = { id: '1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, user as any);

      expect(mockService.create).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with the current user, organizationId, and pagination', async () => {
      const paginated = {
        data: [{ id: '1' }, { id: '2' }],
        total: 2,
        page: 1,
        limit: 20,
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(
        'org1',
        { page: 1, limit: 20 },
        user as any,
      );

      expect(mockService.findAll).toHaveBeenCalledWith(user, 'org1', 1, 20);
      expect(result).toEqual(paginated);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the route id and current user', async () => {
      const department = { id: 'abc' };
      mockService.findOne.mockResolvedValue(department);

      const result = await controller.findOne('abc', user as any);

      expect(mockService.findOne).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(department);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id, dto, and current user', async () => {
      const dto = { name: 'Eng' };
      const updated = { id: 'abc', name: 'Eng' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('abc', dto, user as any);

      expect(mockService.update).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove with the route id and current user', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('abc', user as any);

      expect(mockService.remove).toHaveBeenCalledWith('abc', user);
    });
  });
});
