import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseEnumPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LeaveRequestService } from './leave-request.service.ts';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.ts';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { RolesGuard } from '../auth/guards/roles.guard.ts';
import { Roles } from '../auth/decorators/roles.decorator.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { LeaveStatus, Role } from '../../generated/prisma/enums.js';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiCreatedResponse({
    description: 'Leave request created (status: PENDING)',
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 400, description: 'endDate is before startDate' })
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      "List leave requests within the caller's organization, optionally filtered",
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by employee ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: LeaveStatus,
    description: 'Filter by status',
  })
  @ApiOkResponse({
    description:
      'Paginated list of leave requests: { data, total, page, limit }',
  })
  findAll(
    @Query('employeeId') employeeId: string | undefined,
    @Query('status', new ParseEnumPipe(LeaveStatus, { optional: true }))
    status: LeaveStatus | undefined,
    @Query() { page, limit }: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestService.findAll(
      user,
      employeeId,
      status,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a leave request by ID' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request details' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestService.findOne(id, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request cancelled' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 409,
    description: 'Only pending leave requests can be cancelled',
  })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestService.cancel(id, user);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Approve a pending leave request (admin/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request approved' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 409,
    description:
      'Only pending requests can be approved, or insufficient leave balance',
  })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestService.approve(id, dto, user);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Reject a pending leave request (admin/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request rejected' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 409,
    description: 'Only pending requests can be rejected',
  })
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestService.reject(id, dto, user);
  }
}
