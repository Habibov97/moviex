import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserEntity } from 'src/entity/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), MailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
