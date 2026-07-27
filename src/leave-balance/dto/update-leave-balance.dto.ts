import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class UpdateLeaveBalanceDto {
  @ApiProperty({ example: 18, description: 'New total days granted for the year' })
  @IsInt()
  @IsPositive()
  totalDays: number;
}
