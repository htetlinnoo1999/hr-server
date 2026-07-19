import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto.ts';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
