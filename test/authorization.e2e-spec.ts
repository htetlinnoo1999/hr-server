import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.ts';
import { PrismaService } from '../src/prisma/prisma.service.ts';

interface JsonRecord {
  id: string;
  [key: string]: unknown;
}

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;

  let org1Id: string;
  let org2Id: string;
  let adminToken: string;
  let hr1Token: string;
  let hr2Token: string;
  let employee1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;

    prisma = app.get(PrismaService);

    const org1 = await prisma.organization.create({
      data: { name: 'E2E Org1', slug: 'e2e-org1' },
    });
    const org2 = await prisma.organization.create({
      data: { name: 'E2E Org2', slug: 'e2e-org2' },
    });
    org1Id = org1.id;
    org2Id = org2.id;

    const passwordHash = await bcrypt.hash('e2e-password', 10);
    await prisma.user.create({
      data: {
        email: 'e2e-admin@peoplify.app',
        passwordHash,
        role: 'ADMIN',
        organizationId: null,
      },
    });
    await prisma.user.create({
      data: {
        email: 'e2e-hr1@peoplify.app',
        passwordHash,
        role: 'HR_MANAGER',
        organizationId: org1Id,
      },
    });
    await prisma.user.create({
      data: {
        email: 'e2e-hr2@peoplify.app',
        passwordHash,
        role: 'HR_MANAGER',
        organizationId: org2Id,
      },
    });

    const employee1 = await prisma.employee.create({
      data: {
        organizationId: org1Id,
        employeeCode: 'E2E-001',
        firstName: 'Erin',
        lastName: 'Mployee',
        email: 'erin@e2e-org1.com',
        salary: 1000,
      },
    });
    employee1Id = employee1.id;

    const login = async (email: string) => {
      const res = await request(server)
        .post('/auth/login')
        .send({ email, password: 'e2e-password' });
      const body = res.body as { accessToken: string };
      return body.accessToken;
    };
    adminToken = await login('e2e-admin@peoplify.app');
    hr1Token = await login('e2e-hr1@peoplify.app');
    hr2Token = await login('e2e-hr2@peoplify.app');
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: employee1Id },
    });
    await prisma.employee.deleteMany({
      where: { organizationId: { in: [org1Id, org2Id] } },
    });
    await prisma.department.deleteMany({
      where: { organizationId: { in: [org1Id, org2Id] } },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'e2e-admin@peoplify.app',
            'e2e-hr1@peoplify.app',
            'e2e-hr2@peoplify.app',
          ],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [org1Id, org2Id] } },
    });
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 401: no token at all on every protected controller
  // ---------------------------------------------------------------------------
  describe('unauthenticated requests are rejected with 401', () => {
    const protectedRoutes: Array<[string, string]> = [
      ['GET', '/organizations'],
      ['POST', '/organizations'],
      ['GET', '/organizations/some-id'],
      ['PATCH', '/organizations/some-id'],
      ['DELETE', '/organizations/some-id'],
      ['GET', '/departments'],
      ['POST', '/departments'],
      ['GET', '/departments/some-id'],
      ['GET', '/employees'],
      ['POST', '/employees'],
      ['GET', '/employees/some-id'],
      ['PATCH', '/employees/some-id'],
      ['DELETE', '/employees/some-id'],
      ['GET', '/leave-requests'],
      ['POST', '/leave-requests'],
      ['GET', '/leave-requests/some-id'],
      ['PATCH', '/leave-requests/some-id/cancel'],
    ];

    it.each(protectedRoutes)(
      '%s %s -> 401 without a token',
      async (method, path) => {
        const req = request(server) as unknown as {
          [key: string]: (path: string) => request.Test;
        };
        await req[method.toLowerCase()](path).expect(401);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // 403: admin-only Organization routes rejected for a non-admin
  // ---------------------------------------------------------------------------
  describe('admin-only routes reject non-admin roles with 403', () => {
    it('POST /organizations -> 403 for a non-admin', async () => {
      await request(server)
        .post('/organizations')
        .set('Authorization', `Bearer ${hr1Token}`)
        .send({ name: 'Nope', slug: 'nope' })
        .expect(403);
    });

    it('GET /organizations -> 403 for a non-admin', async () => {
      await request(server)
        .get('/organizations')
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(403);
    });

    it('DELETE /organizations/:id -> 403 for a non-admin', async () => {
      await request(server)
        .delete(`/organizations/${org1Id}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(403);
    });

    it('GET /organizations -> 200 for an admin', async () => {
      await request(server)
        .get('/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-organization isolation at the HTTP layer
  // ---------------------------------------------------------------------------
  describe('cross-organization access is denied with 404', () => {
    it('a non-admin cannot fetch another organization by ID', async () => {
      await request(server)
        .get(`/organizations/${org2Id}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(404);
    });

    it('a non-admin can fetch their own organization', async () => {
      await request(server)
        .get(`/organizations/${org1Id}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(200);
    });

    it('a non-admin cannot fetch an employee from another organization', async () => {
      await request(server)
        .get(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${hr2Token}`)
        .expect(404);
    });

    it('the owning organization can fetch its own employee', async () => {
      await request(server)
        .get(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Full authenticated happy path across every module, chained end to end
  // ---------------------------------------------------------------------------
  describe('authenticated happy path', () => {
    let departmentId: string;
    let newEmployeeId: string;
    let leaveRequestId: string;

    it('creates a department in the caller organization', async () => {
      const res = await request(server)
        .post('/departments')
        .set('Authorization', `Bearer ${hr1Token}`)
        .send({ organizationId: org1Id, name: 'E2E Engineering' })
        .expect(201);
      const body = res.body as JsonRecord;
      departmentId = body.id;
      expect(body.organizationId).toBe(org1Id);
    });

    it('creates an employee in that department', async () => {
      const res = await request(server)
        .post('/employees')
        .set('Authorization', `Bearer ${hr1Token}`)
        .send({
          organizationId: org1Id,
          employeeCode: 'E2E-002',
          firstName: 'New',
          lastName: 'Hire',
          email: 'newhire@e2e-org1.com',
          salary: 1200,
          departmentId,
          employmentType: 'FULL_TIME',
        })
        .expect(201);
      const body = res.body as JsonRecord;
      newEmployeeId = body.id;
      expect(body.departmentId).toBe(departmentId);
    });

    it('submits a leave request for that employee', async () => {
      const res = await request(server)
        .post('/leave-requests')
        .set('Authorization', `Bearer ${hr1Token}`)
        .send({
          employeeId: newEmployeeId,
          leaveType: 'ANNUAL',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
        })
        .expect(201);
      const body = res.body as JsonRecord;
      leaveRequestId = body.id;
      expect(body.status).toBe('PENDING');
    });

    it('another organization cannot view that leave request', async () => {
      await request(server)
        .get(`/leave-requests/${leaveRequestId}`)
        .set('Authorization', `Bearer ${hr2Token}`)
        .expect(404);
    });

    it('cancels the leave request', async () => {
      const res = await request(server)
        .patch(`/leave-requests/${leaveRequestId}/cancel`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(200);
      const body = res.body as JsonRecord;
      expect(body.status).toBe('CANCELLED');
    });

    it('cannot delete the employee while ACTIVE', async () => {
      await request(server)
        .delete(`/employees/${newEmployeeId}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(409);
    });

    it('deletes the employee once set INACTIVE', async () => {
      await request(server)
        .patch(`/employees/${newEmployeeId}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .send({ status: 'INACTIVE' })
        .expect(200);

      await request(server)
        .delete(`/employees/${newEmployeeId}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(204);
    });

    it('deletes the now-empty department', async () => {
      await request(server)
        .delete(`/departments/${departmentId}`)
        .set('Authorization', `Bearer ${hr1Token}`)
        .expect(204);
    });
  });
});
