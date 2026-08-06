import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveBalanceController } from './leave-balance.controller.ts';
import { LeaveBalanceService } from './leave-balance.service.ts';

const mockService = {
  create: jest.fn<any>(),
  bulkCreate: jest.fn<any>(),
  findAll: jest.fn<any>(),
  findOne: jest.fn<any>(),
  update: jest.fn<any>(),
};

const user = {
  id: 'u1',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};

describe('LeaveBalanceController', () => {
  let controller: LeaveBalanceController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveBalanceController],
      providers: [{ provide: LeaveBalanceService, useValue: mockService }],
    }).compile();

    controller = module.get<LeaveBalanceController>(LeaveBalanceController);
  });

  describe('create', () => {
    it('delegates to service.create with the provided dto and current user', async () => {
      const dto = {
        employeeId: 'emp1',
        leaveTypeId: 'lt1',
        year: 2026,
        totalDays: 14,
      };
      const created = { id: 'b1', ...dto };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, user as any);

      expect(mockService.create).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('bulkCreate', () => {
    it('delegates to service.bulkCreate with the provided dto and current user', async () => {
      const dto = {
        employeeId: 'emp1',
        year: 2026,
        balances: [
          { leaveTypeId: 'lt-sick', totalDays: 30 },
          { leaveTypeId: 'lt-annual', totalDays: 10 },
        ],
      };
      const created = { created: 2, skipped: 0, data: [] };
      mockService.bulkCreate.mockResolvedValue(created);

      const result = await controller.bulkCreate(dto as any, user as any);

      expect(mockService.bulkCreate).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll, converting the year query param to a number', async () => {
      const paginated = { data: [{ id: 'b1' }], total: 1, page: 1, limit: 20 };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(
        'emp1',
        '2026',
        { page: 1, limit: 20 },
        user as any,
      );

      expect(mockService.findAll).toHaveBeenCalledWith(
        user,
        'emp1',
        2026,
        1,
        20,
      );
      expect(result).toEqual(paginated);
    });

    it('passes undefined year through when not provided', async () => {
      mockService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await controller.findAll(
        undefined,
        undefined,
        { page: 1, limit: 20 },
        user as any,
      );

      expect(mockService.findAll).toHaveBeenCalledWith(
        user,
        undefined,
        undefined,
        1,
        20,
      );
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the route id and current user', async () => {
      const balance = { id: 'b1' };
      mockService.findOne.mockResolvedValue(balance);

      const result = await controller.findOne('b1', user as any);

      expect(mockService.findOne).toHaveBeenCalledWith('b1', user);
      expect(result).toEqual(balance);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id, dto, and current user', async () => {
      const dto = { totalDays: 18 };
      const updated = { id: 'b1', totalDays: 18 };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('b1', dto, user as any);

      expect(mockService.update).toHaveBeenCalledWith('b1', dto, user);
      expect(result).toEqual(updated);
    });
  });
});
