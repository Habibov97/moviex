import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @ApiProperty({ required: true })
  email!: string;

  @IsString()
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  @ApiProperty({ required: true })
  password!: string;
}
