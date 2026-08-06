import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestController } from './leave-request.controller.ts';
import { LeaveRequestService } from './leave-request.service.ts';

const mockService = {
  create: jest.fn<any>(),
  findAll: jest.fn<any>(),
  findOne: jest.fn<any>(),
  cancel: jest.fn<any>(),
  approve: jest.fn<any>(),
  reject: jest.fn<any>(),
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
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
      };
      const created = { id: '1', ...dto, status: 'PENDING' };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, [], user as any);

      expect(mockService.create).toHaveBeenCalledWith(dto, user, []);
      expect(result).toEqual(created);
    });

    it('passes uploaded attachment files through to service.create', async () => {
      const dto = {
        employeeId: 'emp1',
        leaveTypeId: 'lt-annual',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
      };
      const files = [{ originalname: 'a.jpg' }];
      mockService.create.mockResolvedValue({ id: '1' });

      await controller.create(dto as any, files as any, user as any);

      expect(mockService.create).toHaveBeenCalledWith(dto, user, files);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with the current user, query filters, and pagination', async () => {
      const paginated = {
        data: [{ id: '1' }, { id: '2' }],
        total: 2,
        page: 1,
        limit: 20,
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(
        'emp1',
        'PENDING' as any,
        { page: 1, limit: 20 },
        user as any,
      );

      expect(mockService.findAll).toHaveBeenCalledWith(
        user,
        'emp1',
        'PENDING',
        1,
        20,
      );
      expect(result).toEqual(paginated);
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

  describe('approve', () => {
    it('delegates to service.approve with the route id, dto, and current user', async () => {
      const dto = { reviewNote: 'Approved' };
      const approved = { id: 'abc', status: 'APPROVED' };
      mockService.approve.mockResolvedValue(approved);

      const result = await controller.approve('abc', dto, user as any);

      expect(mockService.approve).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(approved);
    });
  });

  describe('reject', () => {
    it('delegates to service.reject with the route id, dto, and current user', async () => {
      const dto = { reviewNote: 'Not enough coverage' };
      const rejected = { id: 'abc', status: 'REJECTED' };
      mockService.reject.mockResolvedValue(rejected);

      const result = await controller.reject('abc', dto, user as any);

      expect(mockService.reject).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(rejected);
    });
  });
});
