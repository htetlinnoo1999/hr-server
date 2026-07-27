import { PartialType } from '@nestjs/swagger';
import { CreateLeaveTypeDto } from './create-leave-type.dto.ts';

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}
