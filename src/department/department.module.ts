import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service.ts';
import { DepartmentController } from './department.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
