import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { LoginResponse, UserDto } from '@crm/shared';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { configuration } from '../config/configuration';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

const REFRESH_COOKIE = 'crm_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Авторизация пользователя (экранная форма «Вход», ТЗ п. 2.5). */
@Controller('auth')
export class AuthController {
  private readonly cookieSecure = configuration().jwt.cookieSecure;

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  // Пять попыток в минуту с адреса: словарный подбор паролей из README
  // занимал секунды, а каждая попытка ещё и считает bcrypt в event loop
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { refreshToken, ...result } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { refreshToken, ...result } = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE],
    );
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.profile(user.userId);
  }

  /**
   * Refresh-токен хранится в httpOnly cookie: недоступен из JS,
   * поэтому XSS не приводит к угону долгоживущей сессии.
   */
  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: REFRESH_MAX_AGE_MS,
      path: '/api/auth',
    });
  }
}
