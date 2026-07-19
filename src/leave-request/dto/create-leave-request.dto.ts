import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { LeaveType } from '../../../generated/prisma/enums.js';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Employee requesting leave' })
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({
    example: '2026-08-01',
    description: 'First day of leave (ISO 8601)',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2026-08-03',
    description: 'Last day of leave (ISO 8601, inclusive)',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 'Family vacation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
