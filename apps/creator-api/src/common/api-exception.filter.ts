import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ApiError, apiErrorBodySchema, type ApiErrorBody } from '@tg-creator/shared';
import type { Response } from 'express';

type Mapped = { status: number; body: ApiErrorBody };

function fromHttpException(exception: HttpException): Mapped {
  const status = exception.getStatus();
  const response = exception.getResponse();
  const parsed = apiErrorBodySchema.safeParse(response);
  if (parsed.success) {
    return { status, body: parsed.data };
  }
  if (status === HttpStatus.NOT_FOUND) {
    return { status, body: { error: { code: 'NOT_FOUND', message: 'Не найдено' } } };
  }
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
    return {
      status,
      body: { error: { code: 'DOCUMENT_TOO_LARGE', message: 'Запрос слишком большой' } },
    };
  }
  if (status === HttpStatus.BAD_REQUEST) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: { error: { code: 'VALIDATION_FAILED', message: 'Некорректный запрос' } },
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } },
  };
}

/** body-parser rejects oversized or malformed bodies with plain errors, not HttpException. */
function isBodyParserError(exception: unknown): exception is { type: string; status: number } {
  if (typeof exception !== 'object' || exception === null) return false;
  const candidate = exception as { type?: unknown; status?: unknown };
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

/** Every error leaves the API as `{error:{code,message,details?}}` with a docs/06 code. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let mapped: Mapped;
    if (exception instanceof ApiError) {
      mapped = { status: exception.status, body: exception.toJSON() };
    } else if (exception instanceof HttpException) {
      mapped = fromHttpException(exception);
    } else if (isBodyParserError(exception)) {
      mapped = fromHttpException(new HttpException(exception.type, exception.status));
    } else {
      // Only the error itself is logged; request bodies may carry initData or tokens.
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : 'Unknown error',
      );
      mapped = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } },
      };
    }
    response.status(mapped.status).json(mapped.body);
  }
}
