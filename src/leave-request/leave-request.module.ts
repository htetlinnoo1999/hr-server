import { Module } from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service.ts';
import { LeaveRequestController } from './leave-request.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
