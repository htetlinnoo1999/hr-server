import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CountryService } from './country.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  country: {
    findMany: jest.fn<any>(),
  },
};

describe('CountryService', () => {
  let service: CountryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CountryService>(CountryService);
  });

  describe('findAll', () => {
    it('returns all countries ordered by name asc', async () => {
      const countries = [
        { id: '1', name: 'Myanmar', code: 'MM' },
        { id: '2', name: 'Thailand', code: 'TH' },
      ];
      mockPrisma.country.findMany.mockResolvedValue(countries);

      const result = await service.findAll();

      expect(mockPrisma.country.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(countries);
    });
  });
});
