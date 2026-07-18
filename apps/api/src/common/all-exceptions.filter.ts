import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter — stable JSON errors, no stack/secrets in response.
 * Redis-down and similar infra issues must not leak as opaque HTML 500s.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message: string | string[] }).message;
        message = Array.isArray(m) ? m.join('; ') : String(m);
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // Known optional-infra patterns → service unavailable, not opaque 500
      const msg = exception.message ?? '';
      if (
        /Can't reach database server|P1001|P1017|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Redis/i.test(
          msg,
        )
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          /database|P1001|P1017/i.test(msg)
            ? 'Database is unavailable. Start local DB (pnpm db:pglite) and retry.'
            : 'A dependent service is temporarily unavailable. Retry shortly.';
      } else if (/PrismaClient/i.test(exception.name) || /Invalid `.*` invocation/i.test(msg)) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database request failed. Ensure Postgres is running and migrations are applied.';
      } else {
        message = 'Internal server error';
      }
    }

    this.logger.error(
      {
        path: req?.url,
        method: req?.method,
        status,
        // never log full exception objects that might contain secrets
        errName: exception instanceof Error ? exception.name : typeof exception,
        errMessage: exception instanceof Error ? exception.message.slice(0, 200) : undefined,
      },
      'request failed',
    );

    if (!res.headersSent) {
      res.status(status).json({
        statusCode: status,
        message,
        path: req?.url,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
