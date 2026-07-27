import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class PublicHolidayService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.publicHoliday.findMany({ orderBy: { date: 'asc' } });
  }
}
