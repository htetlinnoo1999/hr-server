import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
import { LeaveBalanceService } from './leave-balance.service.ts';
import { CreateLeaveBalanceDto } from './dto/create-leave-balance.dto.ts';
import { UpdateLeaveBalanceDto } from './dto/update-leave-balance.dto.ts';
import { RolloverLeaveBalancesDto } from './dto/rollover-leave-balances.dto.ts';
import { BulkCreateLeaveBalancesDto } from './dto/bulk-create-leave-balances.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { RolesGuard } from '../auth/guards/roles.guard.ts';
import { Roles } from '../auth/decorators/roles.decorator.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@ApiTags('Leave Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-balances')
export class LeaveBalanceController {
  constructor(private readonly leaveBalanceService: LeaveBalanceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({
    summary: 'Create a leave balance for an employee (admin/HR only)',
  })
  @ApiCreatedResponse({ description: 'Leave balance created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Cannot create outside your organization',
  })
  @ApiResponse({ status: 404, description: 'Employee or leave type not found' })
  @ApiResponse({
    status: 409,
    description: 'A balance for this employee/leave type/year already exists',
  })
  create(
    @Body() dto: CreateLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveBalanceService.create(dto, user);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({
    summary:
      'Create several leave balances for one employee in a single call, e.g. sick leave 30, annual 10 (admin/HR only)',
  })
  @ApiCreatedResponse({
    description:
      '{ created, skipped, data } — balances that already existed for a given leave type/year are skipped, not errored on',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot create outside your organization',
  })
  @ApiResponse({ status: 404, description: 'Employee or leave type not found' })
  @ApiResponse({
    status: 400,
    description: 'A leave type was listed more than once in the request',
  })
  bulkCreate(
    @Body() dto: BulkCreateLeaveBalancesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveBalanceService.bulkCreate(dto, user);
  }

  @Post('rollover')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({
    summary:
      "Roll balances from one year into the next, applying each leave type's carry-forward rules (admin/HR only)",
  })
  @ApiCreatedResponse({
    description:
      'Number of new leave balances created (existing ones for the target year are left untouched)',
  })
  @ApiResponse({
    status: 400,
    description: 'toYear must be exactly one year after fromYear',
  })
  rollover(
    @Body() dto: RolloverLeaveBalancesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveBalanceService.rollover(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: "List leave balances within the caller's organization",
  })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiOkResponse({
    description:
      'Paginated list of leave balances: { data, total, page, limit }',
  })
  findAll(
    @Query('employeeId') employeeId: string | undefined,
    @Query('year') year: string | undefined,
    @Query() { page, limit }: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveBalanceService.findAll(
      user,
      employeeId,
      year ? Number(year) : undefined,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a leave balance by ID' })
  @ApiParam({ name: 'id', description: 'Leave balance ID' })
  @ApiOkResponse({ description: 'Leave balance details' })
  @ApiResponse({ status: 404, description: 'Leave balance not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveBalanceService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Adjust a leave balance (admin/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave balance ID' })
  @ApiOkResponse({ description: 'Updated leave balance' })
  @ApiResponse({ status: 404, description: 'Leave balance not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leaveBalanceService.update(id, dto, user);
  }
}
