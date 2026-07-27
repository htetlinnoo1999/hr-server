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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service.ts';
import { CreateOrganizationDto } from './dto/create-organization.dto.ts';
import { UpdateOrganizationDto } from './dto/update-organization.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { RolesGuard } from '../auth/guards/roles.guard.ts';
import { Roles } from '../auth/decorators/roles.decorator.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';
import { Role } from '../../generated/prisma/enums.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new organization (admin only)' })
  @ApiCreatedResponse({ description: 'Organization created successfully' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({
    status: 409,
    description: 'Organization with this name or slug already exists',
  })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all organizations (admin only)' })
  @ApiOkResponse({
    description:
      'Paginated list of organizations: { data, total, page, limit }',
  })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.organizationService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      "Get an organization by ID (must be the caller's own org, unless admin)",
  })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.findOne(id, user);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary:
      "Get an organization by slug (must be the caller's own org, unless admin)",
  })
  @ApiParam({
    name: 'slug',
    description: 'Organization slug (e.g. "peoplify")',
  })
  @ApiOkResponse({ description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.findBySlug(slug, user);
  }

  @Get(':id/branding')
  @ApiOperation({
    summary: 'Get effective branding for an organization',
    description:
      'Returns the organization branding. Missing colors/logo fall back to the default (Peoplify) organization values.',
  })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Effective branding details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  getEffectiveBranding(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.getEffectiveBranding(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      "Update an organization (must be the caller's own org, unless admin)",
  })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Updated organization' })
  @ApiResponse({
    status: 403,
    description: 'Only an admin can change the default organization',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Name or slug conflict' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an organization (admin only)' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiNoContentResponse({ description: 'Organization deleted' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete organization with existing employees',
  })
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }
}
