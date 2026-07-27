import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private client?: S3Client;

  private getClient(): S3Client {
    if (this.client) return this.client;

    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'File upload is not configured (missing S3_REGION, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY)',
      );
    }

    this.client = new S3Client({
      region,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new InternalServerErrorException(
        'File upload is not configured (missing S3_BUCKET)',
      );
    }

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    if (process.env.S3_PUBLIC_URL_BASE) {
      return `${process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
    }
    if (process.env.S3_ENDPOINT) {
      return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
  }
}
