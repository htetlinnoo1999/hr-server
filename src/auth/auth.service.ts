import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async validateEmployee(email: string, password: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
      omit: { passwordHash: false },
    });
    if (!employee) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, employee.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return employee;
  }

  async login(email: string, password: string) {
    const employee = await this.validateEmployee(email, password);

    const payload = {
      sub: employee.id,
      email: employee.email,
      role: employee.role,
      organizationId: employee.organizationId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        organizationId: employee.organizationId,
      },
    };
  }
}
