import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { loginSchema, type LoginDto } from '@fsg/shared';
import { Public } from '../common/public.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'fsg_refresh';
const REFRESH_PATH = '/api/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    // Set COOKIE_SECURE=true behind HTTPS (e.g. Coolify). Leave false for plain HTTP.
    const secure = process.env.COOKIE_SECURE === 'true';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: REFRESH_PATH,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { response, refreshToken } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');
    let payload: { sub: string };
    try {
      payload = this.auth.verifyRefresh(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const { response, refreshToken } = await this.auth.refresh(payload.sub);
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return this.auth.buildAuthUser(user.id);
  }
}
