import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service.ts';
import { OrganizationController } from './organization.controller.ts';
import { PrismaModule } from '../prisma/prisma.module.ts';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
