import { Module } from '@nestjs/common';
import { CountryService } from './country.service.ts';
import { CountryController } from './country.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [CountryController],
  providers: [CountryService],
  exports: [CountryService],
})
export class CountryModule {}
