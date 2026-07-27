import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class CountryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }
}
