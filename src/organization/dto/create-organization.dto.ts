import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, Matches, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Peoplify', description: 'Organization display name' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'peoplify', description: 'URL-friendly unique identifier' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiPropertyOptional({ example: '#4F46E5', description: 'Primary brand color (hex)' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#818CF8', description: 'Secondary brand color (hex)' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png', description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ default: false, description: 'Mark as the default (root) organization' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
