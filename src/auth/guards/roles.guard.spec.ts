import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.ts';

function createMockContext(user: { role: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof jest.fn<any>> };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn<any>() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows the request when no roles metadata is set on the route', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ role: 'EMPLOYEE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the required roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ role: 'EMPLOYEE' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the user does not have a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'HR_MANAGER' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('reads roles metadata from both the handler and the class', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      expect.any(String),
      [context.getHandler(), context.getClass()],
    );
  });
});
