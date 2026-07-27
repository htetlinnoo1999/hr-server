import { Module } from '@nestjs/common';
import { LeaveTypeService } from './leave-type.service.ts';
import { LeaveTypeController } from './leave-type.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveTypeController],
  providers: [LeaveTypeService],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
