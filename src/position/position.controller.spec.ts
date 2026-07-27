import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PositionController } from './position.controller.ts';
import { PositionService } from './position.service.ts';

const mockService = {
  findAll: jest.fn<any>(),
};

describe('PositionController', () => {
  let controller: PositionController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionController],
      providers: [{ provide: PositionService, useValue: mockService }],
    }).compile();

    controller = module.get<PositionController>(PositionController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll and returns the list', async () => {
      const positions = [{ id: '1', title: 'Software Engineer' }];
      mockService.findAll.mockResolvedValue(positions);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(positions);
    });
  });
});
