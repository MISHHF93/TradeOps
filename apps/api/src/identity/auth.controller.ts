import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from '@tradeops/contracts';
import type { Request, Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { CurrentAuth, Public } from './decorators';
import { SessionService } from './session.service';
import type { AuthContext } from './types';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string; path: (string | number)[] }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new BadRequestException(message);
  }
  return result.data;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    this.rateLimit.assertWithinLimit(`register:${ip}`, 10, 15 * 60 * 1000);
    const input = parseBody<RegisterRequest>(registerRequestSchema, body);
    return this.authService.register(input, res, requestMeta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    this.rateLimit.assertWithinLimit(`login:${ip}`, 30, 15 * 60 * 1000);
    const input = parseBody<LoginRequest>(loginRequestSchema, body);
    return this.authService.login(input, res, requestMeta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[this.sessions.cookieName];
    await this.authService.logout(token, res, requestMeta(req));
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext): Promise<AuthResponse> {
    return this.authService.me(
      auth.userId,
      auth.activeOrganizationId,
      auth.activeWorkspaceId,
    );
  }
}
