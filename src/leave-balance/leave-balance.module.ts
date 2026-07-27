import { Module } from '@nestjs/common';
import { LeaveBalanceService } from './leave-balance.service.ts';
import { LeaveBalanceController } from './leave-balance.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveBalanceController],
  providers: [LeaveBalanceService],
  exports: [LeaveBalanceService],
})
export class LeaveBalanceModule {}
