import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Employee requesting leave' })
  @IsString()
  employeeId: string;

  @ApiProperty({ description: 'Leave type this request is for' })
  @IsString()
  leaveTypeId: string;

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
