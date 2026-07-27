import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewLeaveRequestDto {
  @ApiPropertyOptional({ example: 'Approved, enjoy your trip!' })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
