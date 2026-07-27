import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PublicHolidayService } from './public-holiday.service.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';

@ApiTags('Public Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('public-holidays')
export class PublicHolidayController {
  constructor(private readonly publicHolidayService: PublicHolidayService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all public holidays (global, shared across every organization)',
  })
  @ApiOkResponse({ description: 'Array of all public holidays' })
  findAll() {
    return this.publicHolidayService.findAll();
  }
}
