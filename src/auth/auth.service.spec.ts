import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

const mockPrisma = {
  employee: {
    findUnique: jest.fn<any>(),
  },
};

const mockJwtService = {
  signAsync: jest.fn<any>(),
};

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('correct-password', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const baseUser = {
      id: 'u1',
      email: 'jane@example.com',
      role: 'HR_MANAGER',
      organizationId: 'org1',
    };

    it('returns an access token and user info for valid credentials', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
      });
      mockJwtService.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login(
        'jane@example.com',
        'correct-password',
      );

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
        omit: { passwordHash: false },
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'jane@example.com',
        role: 'HR_MANAGER',
        organizationId: 'org1',
      });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: baseUser,
      });
    });

    it('throws UnauthorizedException when the email does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.login('missing@example.com', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is incorrect', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
      });

      await expect(
        service.login('jane@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
