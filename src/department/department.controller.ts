import {
  Controller,
  Get,
  Post,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentService } from './department.service.ts';
import { CreateDepartmentDto } from './dto/create-department.dto.ts';
import { UpdateDepartmentDto } from './dto/update-department.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new department in the caller's organization",
  })
  @ApiCreatedResponse({ description: 'Department created successfully' })
  @ApiResponse({
    status: 409,
    description: 'A department with this name already exists',
  })
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departmentService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: "List departments within the caller's organization",
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Filter by organization ID (admin only; other roles are always scoped to their own org)',
  })
  @ApiOkResponse({
    description: 'Paginated list of departments: { data, total, page, limit }',
  })
  findAll(
    @Query('organizationId') organizationId: string | undefined,
    @Query() { page, limit }: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departmentService.findAll(user, organizationId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiOkResponse({ description: 'Department details' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiOkResponse({ description: 'Updated department' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Name conflict or manager already assigned elsewhere',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departmentService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiNoContentResponse({ description: 'Department deleted' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Department still has employees assigned',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departmentService.remove(id, user);
  }
}
