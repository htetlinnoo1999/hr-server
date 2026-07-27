import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsPositive, Min } from 'class-validator';

export class CreateLeaveBalanceDto {
  @ApiProperty({ description: 'Employee this balance belongs to' })
  @IsString()
  employeeId: string;

  @ApiProperty({ description: 'Leave type this balance is for' })
  @IsString()
  leaveTypeId: string;

  @ApiProperty({ example: 2026, description: 'Calendar year this balance applies to' })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ example: 14, description: 'Total days granted for the year' })
  @IsInt()
  @IsPositive()
  totalDays: number;
}
