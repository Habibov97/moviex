import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @IsEmail()
  @ApiProperty({ required: true, example: 'user@moviex.dev' })
  email!: string;
}
