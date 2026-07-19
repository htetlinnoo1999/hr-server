import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.ts';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;

    expect(() => new JwtStrategy()).toThrow(
      'JWT_SECRET environment variable is not set',
    );
  });

  describe('validate', () => {
    let strategy: JwtStrategy;

    beforeEach(() => {
      strategy = new JwtStrategy();
    });

    it('returns the authenticated user shape from a valid payload', () => {
      const payload = {
        sub: 'u1',
        email: 'jane@example.com',
        role: 'HR_MANAGER',
        organizationId: 'org1',
      };

      const result = strategy.validate(payload as any);

      expect(result).toEqual({
        id: 'u1',
        email: 'jane@example.com',
        role: 'HR_MANAGER',
        organizationId: 'org1',
      });
    });

    it('preserves a null organizationId (platform admin with no org)', () => {
      const payload = {
        sub: 'u1',
        email: 'admin@peoplify.app',
        role: 'ADMIN',
        organizationId: null,
      };

      const result = strategy.validate(payload as any);

      expect(result.organizationId).toBeNull();
    });

    it('throws UnauthorizedException when the payload has no sub', () => {
      const payload = {
        sub: '',
        email: 'jane@example.com',
        role: 'HR_MANAGER',
        organizationId: 'org1',
      };

      expect(() => strategy.validate(payload as any)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
