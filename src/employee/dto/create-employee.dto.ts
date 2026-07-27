import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  IsNumber,
  IsPositive,
  MinLength,
} from 'class-validator';
import {
  Gender,
  EmploymentStatus,
  EmploymentType,
  IdentificationType,
  Role,
} from '../../../generated/prisma/enums.js';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Organization this employee belongs to' })
  @IsString()
  organizationId: string;

  @ApiProperty({ example: 'EMP-0001', description: 'Unique employee code' })
  @IsString()
  employeeCode: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'jane.personal@example.com',
    description: 'Personal (non-work) email address',
  })
  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @ApiPropertyOptional({ example: '+95912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Date of birth (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Myanmar' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({
    enum: IdentificationType,
    description: 'Type of identification document',
  })
  @IsOptional()
  @IsEnum(IdentificationType)
  identificationType?: IdentificationType;

  @ApiPropertyOptional({
    example: '12/YAKANA(N)123456',
    description: 'NRC or passport number',
  })
  @IsOptional()
  @IsString()
  identificationNumber?: string;

  @ApiProperty({
    description:
      'Country this employee belongs to (for public holiday calendar)',
  })
  @IsString()
  countryId: string;

  @ApiPropertyOptional({ example: 'No. 12, Bogyoke Aung San Street, Yangon' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'KBZ Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '0123456789012' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    example: '2024-01-15',
    description: 'Hire date (ISO 8601), defaults to now',
  })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiProperty({ example: 1500000, description: 'Monthly salary' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  salary: number;

  @ApiPropertyOptional({
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiPropertyOptional({
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Position ID' })
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiPropertyOptional({
    description:
      'Direct report to — the ID of the employee they report to. Must belong to the same organization.',
  })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.EMPLOYEE,
    description:
      'Login role for the new account. Only an admin may set a role other than EMPLOYEE.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
