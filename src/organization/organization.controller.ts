import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiCreatedResponse({ description: 'Organization created successfully' })
  @ApiResponse({ status: 409, description: 'Organization with this name or slug already exists' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations (Peoplify admin use)' })
  @ApiOkResponse({ description: 'Array of all organizations' })
  findAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get an organization by slug' })
  @ApiParam({ name: 'slug', description: 'Organization slug (e.g. "peoplify")' })
  @ApiOkResponse({ description: 'Organization details' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.organizationService.findBySlug(slug);
  }

  @Get(':id/branding')
  @ApiOperation({
    summary: 'Get effective branding for an organization',
    description:
      'Returns the organization branding. Missing colors/logo fall back to the default (Peoplify) organization values.',
  })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Effective branding details' })
  getEffectiveBranding(@Param('id') id: string) {
    return this.organizationService.getEffectiveBranding(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiOkResponse({ description: 'Updated organization' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Name or slug conflict' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an organization' })
  @ApiParam({ name: 'id', description: 'Organization ID' })
  @ApiNoContentResponse({ description: 'Organization deleted' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }
}
