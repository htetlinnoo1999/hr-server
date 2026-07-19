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
import { EmployeeService } from './employee.service.ts';
import { CreateEmployeeDto } from './dto/create-employee.dto.ts';
import { UpdateEmployeeDto } from './dto/update-employee.dto.ts';
import { CreateEmployeeContractDto } from './dto/create-employee-contract.dto.ts';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';
import { CurrentUser } from '../auth/decorators/current-user.decorator.ts';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.ts';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiCreatedResponse({ description: 'Employee created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Cannot create an employee outside your organization',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({
    status: 409,
    description:
      'Employee with this code, email, or identification number already exists',
  })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: "List employees within the caller's organization" })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'Filter by organization ID (admin only; other roles are always scoped to their own org)',
  })
  @ApiOkResponse({ description: 'Array of employees' })
  findAll(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.findAll(user, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Employee details' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Updated employee' })
  @ApiResponse({
    status: 403,
    description: 'Cannot move an employee to a different organization',
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Code, email, or identification number conflict',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee (must be INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiNoContentResponse({ description: 'Employee deleted' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Only inactive employees can be deleted',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.remove(id, user);
  }

  @Post(':id/contracts')
  @ApiOperation({ summary: 'Add a contract for an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiCreatedResponse({ description: 'Contract created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  addContract(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.addContract(id, dto, user);
  }

  @Get(':id/contracts')
  @ApiOperation({ summary: "List an employee's contracts" })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Array of contracts' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  listContracts(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.listContracts(id, user);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Add a document for an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiCreatedResponse({ description: 'Document created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  addDocument(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.addDocument(id, dto, user);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: "List an employee's additional documents" })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Array of documents' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  listDocuments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.listDocuments(id, user);
  }
}
