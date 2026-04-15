import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
