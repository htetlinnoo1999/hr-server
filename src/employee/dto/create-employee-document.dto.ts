import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateEmployeeDocumentDto {
  @ApiProperty({
    example: 'Educational Certificate',
    description: 'Type/category of the document',
  })
  @IsString()
  documentType: string;

  @ApiProperty({ example: 'https://example.com/docs/emp-0001-certificate.pdf' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ example: 'Bachelor degree certificate' })
  @IsOptional()
  @IsString()
  description?: string;
}
