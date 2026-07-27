import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveTypeController } from './leave-type.controller.ts';
import { LeaveTypeService } from './leave-type.service.ts';

const mockService = {
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

describe('LeaveTypeController', () => {
  let controller: LeaveTypeController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveTypeController],
      providers: [{ provide: LeaveTypeService, useValue: mockService }],
    }).compile();

    controller = module.get<LeaveTypeController>(LeaveTypeController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll with the current user, organizationId, and pagination', async () => {
      const paginated = { data: [{ id: 'lt1' }], total: 1, page: 1, limit: 20 };
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
      const leaveType = { id: 'lt1' };
      mockService.findOne.mockResolvedValue(leaveType);

      const result = await controller.findOne('lt1', user as any);

      expect(mockService.findOne).toHaveBeenCalledWith('lt1', user);
      expect(result).toEqual(leaveType);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id, dto, and current user', async () => {
      const dto = { daysPerYear: 18 };
      const updated = { id: 'lt1', daysPerYear: 18 };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('lt1', dto, user as any);

      expect(mockService.update).toHaveBeenCalledWith('lt1', dto, user);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove with the route id and current user', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove('lt1', user as any);

      expect(mockService.remove).toHaveBeenCalledWith('lt1', user);
    });
  });
});
