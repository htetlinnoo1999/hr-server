import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'htetlinnoo19@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'asdf1234' })
  @IsString()
  @MinLength(4)
  password: string;
}
