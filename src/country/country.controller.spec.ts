import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CountryController } from './country.controller.ts';
import { CountryService } from './country.service.ts';

const mockService = {
  findAll: jest.fn<any>(),
};

describe('CountryController', () => {
  let controller: CountryController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CountryController],
      providers: [{ provide: CountryService, useValue: mockService }],
    }).compile();

    controller = module.get<CountryController>(CountryController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll and returns the list', async () => {
      const countries = [{ id: '1', name: 'Myanmar', code: 'MM' }];
      mockService.findAll.mockResolvedValue(countries);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(countries);
    });
  });
});
