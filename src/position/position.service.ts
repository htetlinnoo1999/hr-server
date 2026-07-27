import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class PositionService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.position.findMany({ orderBy: { title: 'asc' } });
  }
}
