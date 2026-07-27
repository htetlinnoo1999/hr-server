import { Module } from '@nestjs/common';
import { PositionService } from './position.service.ts';
import { PositionController } from './position.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [PositionController],
  providers: [PositionService],
  exports: [PositionService],
})
export class PositionModule {}
