import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CountryService } from './country.service.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';

@ApiTags('Countries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('countries')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Get()
  @ApiOperation({ summary: 'List all countries' })
  @ApiOkResponse({ description: 'Array of all countries' })
  findAll() {
    return this.countryService.findAll();
  }
}
