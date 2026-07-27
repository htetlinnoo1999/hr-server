import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeController } from './employee.controller.ts';
import { EmployeeService } from './employee.service.ts';

const mockService = {
  create: jest.fn<any>(),
  findAll: jest.fn<any>(),
  listOptions: jest.fn<any>(),
  findOne: jest.fn<any>(),
  getProfile: jest.fn<any>(),
  update: jest.fn<any>(),
  updateOwnProfile: jest.fn<any>(),
  remove: jest.fn<any>(),
  addContract: jest.fn<any>(),
  listContracts: jest.fn<any>(),
  addDocument: jest.fn<any>(),
  listDocuments: jest.fn<any>(),
};

const user = {
  id: 'u1',
  email: 'hr@acme.com',
  role: 'HR_MANAGER',
  organizationId: 'org1',
};

describe('EmployeeController', () => {
  let controller: EmployeeController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [{ provide: EmployeeService, useValue: mockService }],
    }).compile();

    controller = module.get<EmployeeController>(EmployeeController);
  });

  describe('create', () => {
    it('delegates to service.create with the provided dto and current user', async () => {
      const dto = {
        organizationId: 'org1',
        employeeCode: 'EMP-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        salary: 1000,
      };
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

  describe('findOptions', () => {
    it('delegates to service.listOptions with the current user', async () => {
      const options = [{ id: '1', name: 'Jane Doe' }];
      mockService.listOptions.mockResolvedValue(options);

      const result = await controller.findOptions(user as any);

      expect(mockService.listOptions).toHaveBeenCalledWith(user);
      expect(result).toEqual(options);
    });
  });

  describe('findOne', () => {
    it('delegates to service.getProfile with the route id and current user', async () => {
      const employee = { id: 'abc' };
      mockService.getProfile.mockResolvedValue(employee);

      const result = await controller.findOne('abc', user as any);

      expect(mockService.getProfile).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(employee);
    });
  });

  describe('update', () => {
    it('delegates to service.update with the route id, dto, and current user', async () => {
      const dto = { firstName: 'Janet' };
      const updated = { id: 'abc', firstName: 'Janet' };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update('abc', dto, user as any);

      expect(mockService.update).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(updated);
    });
  });

  describe('updateMyProfile', () => {
    it('delegates to service.updateOwnProfile with the dto, uploaded file, and current user', async () => {
      const dto = { nickname: 'Janie' };
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        originalname: 'pic.png',
      };
      const updated = { id: 'abc', nickname: 'Janie' };
      mockService.updateOwnProfile.mockResolvedValue(updated);

      const result = await controller.updateMyProfile(
        dto as any,
        file as any,
        user as any,
      );

      expect(mockService.updateOwnProfile).toHaveBeenCalledWith(
        user,
        dto,
        file,
      );
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

  describe('addContract', () => {
    it('delegates to service.addContract with the employee id, dto, and current user', async () => {
      const dto = { contractType: 'PERMANENT', startDate: '2024-01-15' };
      const created = { id: 'c1', ...dto };
      mockService.addContract.mockResolvedValue(created);

      const result = await controller.addContract(
        'abc',
        dto as any,
        user as any,
      );

      expect(mockService.addContract).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('listContracts', () => {
    it('delegates to service.listContracts with the employee id and current user', async () => {
      const contracts = [{ id: 'c1' }];
      mockService.listContracts.mockResolvedValue(contracts);

      const result = await controller.listContracts('abc', user as any);

      expect(mockService.listContracts).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(contracts);
    });
  });

  describe('addDocument', () => {
    it('delegates to service.addDocument with the employee id, dto, and current user', async () => {
      const dto = {
        documentType: 'Certificate',
        fileUrl: 'https://example.com/doc.pdf',
      };
      const created = { id: 'd1', ...dto };
      mockService.addDocument.mockResolvedValue(created);

      const result = await controller.addDocument(
        'abc',
        dto as any,
        user as any,
      );

      expect(mockService.addDocument).toHaveBeenCalledWith('abc', dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('listDocuments', () => {
    it('delegates to service.listDocuments with the employee id and current user', async () => {
      const documents = [{ id: 'd1' }];
      mockService.listDocuments.mockResolvedValue(documents);

      const result = await controller.listDocuments('abc', user as any);

      expect(mockService.listDocuments).toHaveBeenCalledWith('abc', user);
      expect(result).toEqual(documents);
    });
  });
});
