import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { resolveRequestLanguage, runWithLanguage } from './request-language';

/**
 * Opens the per-request language context for every route.
 *
 * Middleware runs before guards, interceptors, pipes and multer's `fileFilter`,
 * so every place that can throw a user-facing message is already inside the
 * context by the time it runs. `next()` is called INSIDE `runWithLanguage`, so
 * the whole downstream chain — including everything it awaits — inherits it.
 */
@Injectable()
export class LanguageMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    runWithLanguage(resolveRequestLanguage(req.headers['accept-language']), next);
  }
}
