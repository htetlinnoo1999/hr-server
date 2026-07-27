import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PositionService } from './position.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  position: {
    findMany: jest.fn<any>(),
  },
};

describe('PositionService', () => {
  let service: PositionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
  });

  describe('findAll', () => {
    it('returns all positions ordered by title asc', async () => {
      const positions = [
        { id: '1', title: 'Account Executive' },
        { id: '2', title: 'Software Engineer' },
      ];
      mockPrisma.position.findMany.mockResolvedValue(positions);

      const result = await service.findAll();

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        orderBy: { title: 'asc' },
      });
      expect(result).toEqual(positions);
    });
  });
});
