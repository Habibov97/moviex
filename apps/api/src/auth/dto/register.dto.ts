import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(4, {
    message: 'Username must be at least 4 characters',
  })
  @ApiProperty({ required: true })
  userName!: string;

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
