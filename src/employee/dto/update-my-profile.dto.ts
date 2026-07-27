import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Janie', description: 'Preferred display name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;
}
