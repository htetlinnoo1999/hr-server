import { Module } from '@nestjs/common';
import { AppController } from './app.controller.ts';
import { AppService } from './app.service.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { OrganizationModule } from './organization/organization.module.ts';
import { DepartmentModule } from './department/department.module.ts';
import { EmployeeModule } from './employee/employee.module.ts';
import { PositionModule } from './position/position.module.ts';
import { LeaveTypeModule } from './leave-type/leave-type.module.ts';
import { LeaveBalanceModule } from './leave-balance/leave-balance.module.ts';
import { LeaveRequestModule } from './leave-request/leave-request.module.ts';
import { PublicHolidayModule } from './public-holiday/public-holiday.module.ts';
import { CountryModule } from './country/country.module.ts';
import { AuthModule } from './auth/auth.module.ts';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    DepartmentModule,
    EmployeeModule,
    PositionModule,
    LeaveTypeModule,
    LeaveBalanceModule,
    LeaveRequestModule,
    PublicHolidayModule,
    CountryModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
