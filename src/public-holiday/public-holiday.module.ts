import { Module } from '@nestjs/common';
import { PublicHolidayService } from './public-holiday.service.ts';
import { PublicHolidayController } from './public-holiday.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [PublicHolidayController],
  providers: [PublicHolidayService],
  exports: [PublicHolidayService],
})
export class PublicHolidayModule {}
