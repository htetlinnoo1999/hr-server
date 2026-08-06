import { Module } from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service.ts';
import { LeaveRequestController } from './leave-request.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';
import { UploadModule } from '../upload/upload.module.ts';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
