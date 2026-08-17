import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entity/user.entity';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import jwtConfig from 'src/config/jwt.config';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}
  async signUp(dto: RegisterDto) {
    const user = await this.userRepository.findOne({
      where: [{ email: dto.email }, { userName: dto.userName }],
    });

    if (user) throw new NotFoundException('User already exists');

    let createdUser = this.userRepository.create(dto);

    createdUser.password = await bcrypt.hash(
      createdUser.password,
      this.saltRounds,
    );

    await this.userRepository.save(createdUser);

    const newUser = { ...createdUser, password: undefined };

    return {
      status: 'success',
      message: 'User has been created successfully',
      newUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    console.log(this.jwtConfiguration);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtConfiguration.secret as string,
      {
        expiresIn: this.jwtConfiguration
          .expiresIn as jwt.SignOptions['expiresIn'],
      },
    );

    return {
      status: 'success',
      accessToken,
    };
  }
}
