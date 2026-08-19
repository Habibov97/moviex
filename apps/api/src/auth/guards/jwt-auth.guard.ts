import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import jwtConfig from 'src/config/jwt.config';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

export interface JwtPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Missing access token cookie');

    try {
      const payload = jwt.verify(
        token,
        this.jwtConfiguration.secret as string,
      ) as unknown as JwtPayload;

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Reads the token from the httpOnly cookie rather than the Authorization
   * header — the header is deliberately no longer accepted, so a token that
   * leaked to client JavaScript cannot be replayed as a bearer credential.
   *
   * Depends on `cookieParser()` being registered in `main.ts`; without it
   * `request.cookies` is undefined and every guarded route 401s.
   */
  private extractToken(request: Request): string | undefined {
    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];
    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }
}
