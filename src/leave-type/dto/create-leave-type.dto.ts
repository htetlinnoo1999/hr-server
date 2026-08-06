import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsPositive,
  Min,
  MinLength,
} from 'class-validator';
import { Gender } from '../../../generated/prisma/enums.js';

export class CreateLeaveTypeDto {
  @ApiProperty({ description: 'Organization this leave type belongs to' })
  @IsString()
  organizationId: string;

  @ApiProperty({ example: 'Annual' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 14, description: 'Days granted per year' })
  @IsInt()
  @IsPositive()
  daysPerYear: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description: 'Max days that can be carried into the next year',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCarryDays?: number;

  @ApiPropertyOptional({
    enum: Gender,
    description:
      'Restrict this leave type to employees of this gender (e.g. Maternal → FEMALE). Omit for no restriction.',
  })
  @IsOptional()
  @IsEnum(Gender)
  restrictedGender?: Gender;

  @ApiPropertyOptional({ example: 'Paid annual vacation leave' })
  @IsOptional()
  @IsString()
  description?: string;
}
