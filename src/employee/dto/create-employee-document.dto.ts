import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateEmployeeDocumentDto {
  @ApiProperty({
    example: 'Educational Certificate',
    description: 'Type/category of the document',
  })
  @IsString()
  documentType: string;

  @ApiPropertyOptional({
    example: 'https://example.com/docs/emp-0001-certificate.pdf',
    description:
      'URL of an already-hosted file. Ignored if a `file` is uploaded instead.',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'Bachelor degree certificate' })
  @IsOptional()
  @IsString()
  description?: string;
}
