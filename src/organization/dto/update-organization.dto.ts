import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organization.dto.ts';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
