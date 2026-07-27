import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PublicHolidayService } from './public-holiday.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  publicHoliday: {
    findMany: jest.fn<any>(),
  },
};

describe('PublicHolidayService', () => {
  let service: PublicHolidayService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicHolidayService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PublicHolidayService>(PublicHolidayService);
  });

  describe('findAll', () => {
    it('returns all public holidays ordered by date asc', async () => {
      const holidays = [
        { id: '1', name: "New Year's Day", date: '2027-01-01' },
        { id: '2', name: 'Independence Day', date: '2027-01-04' },
      ];
      mockPrisma.publicHoliday.findMany.mockResolvedValue(holidays);

      const result = await service.findAll();

      expect(mockPrisma.publicHoliday.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'asc' },
      });
      expect(result).toEqual(holidays);
    });
  });
});
