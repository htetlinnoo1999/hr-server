import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import {
  ContractType,
  ContractStatus,
} from '../../../generated/prisma/enums.js';

export class CreateEmployeeContractDto {
  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType: ContractType;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Contract start date (ISO 8601)',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: '2025-01-14',
    description: 'Contract end date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/contracts/emp-0001.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ enum: ContractStatus, default: ContractStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}
