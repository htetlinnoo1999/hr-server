import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PositionService } from './position.service.ts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.ts';

@ApiTags('Positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('positions')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @Get()
  @ApiOperation({ summary: 'List all positions' })
  @ApiOkResponse({ description: 'Array of all positions' })
  findAll() {
    return this.positionService.findAll();
  }
}
