import { Module } from '@nestjs/common';
import { AppController } from './app.controller.ts';
import { AppService } from './app.service.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { OrganizationModule } from './organization/organization.module.ts';
import { DepartmentModule } from './department/department.module.ts';
import { EmployeeModule } from './employee/employee.module.ts';
import { LeaveRequestModule } from './leave-request/leave-request.module.ts';
import { AuthModule } from './auth/auth.module.ts';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    DepartmentModule,
    EmployeeModule,
    LeaveRequestModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
