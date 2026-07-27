import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LeaveTypeService } from './leave-type.service.ts';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { RolesGuard } from '../auth/guards/roles.guard.ts';
import { Roles } from '../auth/decorators/roles.decorator.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@ApiTags('Leave Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-types')
export class LeaveTypeController {
  constructor(private readonly leaveTypeService: LeaveTypeService) {}

  @Get()
  @ApiOperation({
    summary: "List leave types within the caller's organization",
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Filter by organization ID (admin only; other roles are always scoped to their own org)',
  })
  @ApiOkResponse({
    description: 'Paginated list of leave types: { data, total, page, limit }',
  })
  findAll(
    @Query('organizationId') organizationId: string | undefined,
    @Query() { page, limit }: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveTypeService.findAll(user, organizationId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a leave type by ID' })
  @ApiParam({ name: 'id', description: 'Leave type ID' })
  @ApiOkResponse({ description: 'Leave type details' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveTypeService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Update a leave type (admin/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave type ID' })
  @ApiOkResponse({ description: 'Updated leave type' })
  @ApiResponse({
    status: 403,
    description: 'Cannot move a leave type to a different organization',
  })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @ApiResponse({ status: 409, description: 'Name conflict' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveTypeService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a leave type (admin/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave type ID' })
  @ApiNoContentResponse({ description: 'Leave type deleted' })
  @ApiResponse({ status: 404, description: 'Leave type not found' })
  @ApiResponse({
    status: 409,
    description: 'Leave type still has balances or requests referencing it',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveTypeService.remove(id, user);
  }
}
