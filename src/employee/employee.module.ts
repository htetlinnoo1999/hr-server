import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service.ts';
import { EmployeeController } from './employee.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
