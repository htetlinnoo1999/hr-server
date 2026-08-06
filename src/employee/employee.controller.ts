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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service.ts';
import { CreateEmployeeDto } from './dto/create-employee.dto.ts';
import { UpdateEmployeeDto } from './dto/update-employee.dto.ts';
import { CreateEmployeeContractDto } from './dto/create-employee-contract.dto.ts';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto.ts';
import { CreateEmployeeAllowanceDto } from './dto/create-employee-allowance.dto.ts';
import { UpdateEmployeeAllowanceDto } from './dto/update-employee-allowance.dto.ts';
import { ContractType, ContractStatus } from '../../generated/prisma/enums.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.ts';
import { HeadcountQueryDto } from './dto/headcount-query.dto.ts';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.ts';
import {
  IMAGE_UPLOAD_OPTIONS,
  DOCUMENT_UPLOAD_OPTIONS,
} from '../upload/upload-options.ts';
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
  @ApiOperation({
    summary: "Create a new employee in the caller's organization",
  })
  @ApiCreatedResponse({
    description:
      'Employee created successfully. The response includes a one-time `temporaryPassword` for the new login — it is never shown again.',
  })
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
  @ApiOkResponse({
    description:
      'Paginated list of employees: { data, total, page, limit }. Each employee omits phone, address, bankAccountNumber, and salary — fetch a single employee for those fields.',
  })
  findAll(
    @Query('organizationId') organizationId: string | undefined,
    @Query() { page, limit }: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.findAll(user, organizationId, page, limit);
  }

  @Get('options')
  @ApiOperation({
    summary:
      "List the caller's organization employees as { id, name } pairs, for dropdown use",
  })
  @ApiOkResponse({ description: 'Array of { id, name }, unpaginated' })
  findOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.listOptions(user);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('profilePicture', IMAGE_UPLOAD_OPTIONS))
  @ApiOperation({
    summary: "Update the caller's own nickname / profile picture",
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Updated employee' })
  @ApiResponse({
    status: 404,
    description: 'No employee profile linked to this account',
  })
  updateMyProfile(
    @Body() dto: UpdateMyProfileDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.updateOwnProfile(user, dto, file);
  }

  @Get('headcount')
  @ApiOperation({
    summary: 'Monthly employee headcount for a given year',
    description:
      'Cumulative headcount at the end of each month (Jan-Dec), based on hire date. ' +
      'Departures are not backdated since only a current status is tracked, not a termination date.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Year to report on (defaults to the current year)',
  })
  @ApiOkResponse({
    description: 'Array of { month, count } for months 1-12',
  })
  getHeadcount(
    @Query() { year }: HeadcountQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.getMonthlyHeadcount(
      user,
      year ?? new Date().getFullYear(),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({
    description:
      "Employee details, including their organization, this year's leave balances (days used/remaining per leave type), and their 5 most recent approved leave requests.",
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.getProfile(id, user);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('profilePicture', IMAGE_UPLOAD_OPTIONS))
  @ApiOperation({ summary: 'Update an employee' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Updated employee' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Code, email, or identification number conflict',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.update(id, dto, user, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an employee (must be INACTIVE or TERMINATED)',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiNoContentResponse({ description: 'Employee deleted' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Only inactive or terminated employees can be deleted',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.remove(id, user);
  }

  @Post(':id/contracts')
  @UseInterceptors(FileInterceptor('file', DOCUMENT_UPLOAD_OPTIONS))
  @ApiOperation({
    summary: 'Add a contract for an employee',
    description:
      'Accepts an optional image or PDF via the `file` field, uploaded to S3. ' +
      'A `fileUrl` may be sent instead (or as a fallback) if the file is already hosted elsewhere.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractType: { type: 'string', enum: Object.values(ContractType) },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        status: { type: 'string', enum: Object.values(ContractStatus) },
        fileUrl: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiCreatedResponse({ description: 'Contract created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  addContract(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeContractDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.addContract(id, dto, user, file);
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
  @UseInterceptors(FileInterceptor('file', DOCUMENT_UPLOAD_OPTIONS))
  @ApiOperation({
    summary: 'Add a document for an employee',
    description:
      'Accepts an image or PDF via the `file` field, uploaded to S3. ' +
      'A `fileUrl` may be sent instead if the file is already hosted elsewhere — one of the two is required.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string' },
        description: { type: 'string' },
        fileUrl: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiCreatedResponse({ description: 'Document created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 400,
    description: 'Either a file upload or fileUrl is required',
  })
  addDocument(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.addDocument(id, dto, user, file);
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

  @Post(':id/allowances')
  @ApiOperation({
    summary: 'Add a recurring monthly allowance for an employee',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiCreatedResponse({ description: 'Allowance created' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  addAllowance(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeAllowanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.addAllowance(id, dto, user);
  }

  @Get(':id/allowances')
  @ApiOperation({ summary: "List an employee's allowances" })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiOkResponse({ description: 'Array of allowances' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  listAllowances(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.listAllowances(id, user);
  }

  @Patch(':id/allowances/:allowanceId')
  @ApiOperation({ summary: 'Update an allowance' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiParam({ name: 'allowanceId', description: 'Allowance ID' })
  @ApiOkResponse({ description: 'Updated allowance' })
  @ApiResponse({ status: 404, description: 'Employee or allowance not found' })
  updateAllowance(
    @Param('id') id: string,
    @Param('allowanceId') allowanceId: string,
    @Body() dto: UpdateEmployeeAllowanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.updateAllowance(id, allowanceId, dto, user);
  }

  @Delete(':id/allowances/:allowanceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an allowance' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiParam({ name: 'allowanceId', description: 'Allowance ID' })
  @ApiNoContentResponse({ description: 'Allowance deleted' })
  @ApiResponse({ status: 404, description: 'Employee or allowance not found' })
  removeAllowance(
    @Param('id') id: string,
    @Param('allowanceId') allowanceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeeService.removeAllowance(id, allowanceId, user);
  }
}
