import { Module } from '@nestjs/common';
import { S3Service } from './s3.service.ts';

@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class UploadModule {}
