import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.ts';
import { AuthService } from './auth.service.ts';

const mockService = {
  login: jest.fn<any>(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('delegates to service.login with the email and password from the dto', async () => {
      const dto = { email: 'jane@example.com', password: 'secret123' };
      const result = {
        accessToken: 'jwt',
        user: { id: 'u1', email: dto.email },
      };
      mockService.login.mockResolvedValue(result);

      const response = await controller.login(dto);

      expect(mockService.login).toHaveBeenCalledWith(dto.email, dto.password);
      expect(response).toEqual(result);
    });
  });
});
