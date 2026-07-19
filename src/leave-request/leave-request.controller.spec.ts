import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestController } from './leave-request.controller.ts';
import { LeaveRequestService } from './leave-request.service.ts';

const mockService = {
  create: jest.fn<any>(),
  findAll: jest.fn<any>(),
  findOne: jest.fn<any>(),
  cancel: jest.fn<any>(),
};

const user = {
  id: 'u1',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};

describe('LeaveRequestController', () => {
  let controller: LeaveRequestController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveRequestController],
      providers: [{ provide: LeaveRequestService, useValue: mockService }],
    }).compile();

    controller = module.get<LeaveRequestController>(LeaveRequestController);
  });

  describe('create', () => {
    it('delegates to service.create with the provided dto and current user', async () => {
      const dto = {
        employeeId: 'emp1',
        leaveType: 'ANNUAL',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
      };
      const created = { id: '1', ...dto, status: 'PENDING' };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, user as any);

      expect(mockService.create).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with the current user and query filters', async () => {
      const leaveRequests = [{ id: '1' }, { id: '2' }];
      mockService.findAll.mockResolvedValue(leaveRequests);

      const result = await controller.findAll(
        'emp1',
        'PENDING' as any,
        user as any,
      );

      expect(mockService.findAll).toHaveBeenCalledWith(user, 'emp1', 'PENDING');
      expect(result).toEqual(leaveRequests);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with the route id and current user', async () => {
      const leaveRequest = { id: 'abc' };
      mockService.findOne.mockResolvedValue(leaveRequest);

      const result = await controller.findOne('abc', user as any);

      expect(mockService.findOne).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(leaveRequest);
    });
  });

  describe('cancel', () => {
    it('delegates to service.cancel with the route id and current user', async () => {
      const cancelled = { id: 'abc', status: 'CANCELLED' };
      mockService.cancel.mockResolvedValue(cancelled);

      const result = await controller.cancel('abc', user as any);

      expect(mockService.cancel).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(cancelled);
    });
  });
});
