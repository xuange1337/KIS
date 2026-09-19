import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { LoginResponse, SessionDto, UserDto } from '@crm/shared';
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
const CSRF_COOKIE = 'crm_csrf';
const CSRF_HEADER = 'x-csrf-token';
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
    this.setCsrfCookie(res, randomBytes(32).toString('hex'));
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    this.assertCsrf(req);
    const { refreshToken, ...result } = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE],
    );
    this.setRefreshCookie(res, refreshToken);
    /**
     * CSRF-cookie продлевается вместе с refresh-токеном.
     *
     * Срок жизни у них одинаковый, но refresh-cookie переустанавливается
     * при каждом обновлении, а CSRF-cookie раньше выдавалась только при
     * входе. У пользователя, который не выходил из системы неделю, она
     * истекала первой, и все последующие обновления получали 403 без
     * внятной причины: сессия ещё жива, а проверка уже не проходит.
     */
    this.setCsrfCookie(res, randomBytes(32).toString('hex'));
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    this.assertCsrf(req);
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.profile(user.userId);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.authService.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSession(user.userId, sessionId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(@CurrentUser() user: AuthUser): Promise<void> {
    await this.authService.revokeAllSessions(user.userId);
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

  private setCsrfCookie(res: Response, token: string): void {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: this.cookieSecure,
      maxAge: REFRESH_MAX_AGE_MS,
      path: '/',
    });
  }

  private assertCsrf(req: Request): void {
    const cookie = req.cookies?.[CSRF_COOKIE];
    const header = req.get(CSRF_HEADER);
    if (typeof cookie !== 'string' || typeof header !== 'string') {
      throw new ForbiddenException('CSRF-проверка не пройдена');
    }
    const cookieBuffer = Buffer.from(cookie);
    const headerBuffer = Buffer.from(header);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new ForbiddenException('CSRF-проверка не пройдена');
    }
  }
}
