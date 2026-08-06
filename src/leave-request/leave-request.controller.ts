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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LeaveRequestService } from './leave-request.service.ts';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.ts';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { LeaveStatus } from '../../generated/prisma/enums.js';
import { IMAGE_UPLOAD_OPTIONS } from '../upload/upload-options.ts';

const MAX_LEAVE_REQUEST_ATTACHMENTS = 5;

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'attachments',
      MAX_LEAVE_REQUEST_ATTACHMENTS,
      IMAGE_UPLOAD_OPTIONS,
    ),
  )
  @ApiOperation({
    summary: 'Submit a leave request',
    description:
      'Accepts up to 5 image attachments (e.g. a medical certificate) via the `attachments` field.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        leaveTypeId: { type: 'string' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        reason: { type: 'string' },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Leave request created (status: PENDING)',
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 400, description: 'endDate is before startDate' })
  create(
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveRequestService.create(dto, user, files);
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
  @ApiOperation({
    summary:
      "Approve a pending leave request (admin, HR manager, or the employee's manager)",
  })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request approved' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 403,
    description:
      "Only an admin, HR manager, or the employee's manager can review this request",
  })
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
  @ApiOperation({
    summary:
      "Reject a pending leave request (admin, HR manager, or the employee's manager)",
  })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  @ApiOkResponse({ description: 'Leave request rejected' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({
    status: 403,
    description:
      "Only an admin, HR manager, or the employee's manager can review this request",
  })
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
