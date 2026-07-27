import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicHolidayController } from './public-holiday.controller.ts';
import { PublicHolidayService } from './public-holiday.service.ts';

const mockService = {
  findAll: jest.fn<any>(),
};

describe('PublicHolidayController', () => {
  let controller: PublicHolidayController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicHolidayController],
      providers: [{ provide: PublicHolidayService, useValue: mockService }],
    }).compile();

    controller = module.get<PublicHolidayController>(PublicHolidayController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll and returns the list', async () => {
      const holidays = [{ id: '1', name: "New Year's Day" }];
      mockService.findAll.mockResolvedValue(holidays);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(holidays);
    });
  });
});
