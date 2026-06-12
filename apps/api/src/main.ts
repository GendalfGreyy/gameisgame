import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService<Env, true>);
  const port: number =
    configService.get('PORT', { infer: true }) ??
    configService.get('API_PORT', { infer: true }) ??
    3001;
  const webappUrl = configService.get('TELEGRAM_WEBAPP_URL', { infer: true });
  const corsOrigins = [
    ...new Set(
      [
        ...configService
          .get('API_CORS_ORIGINS', { infer: true })
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
        webappUrl,
      ].filter((origin) => origin.length > 0),
    ),
  ];
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const cloudflareDevOrigin = /^https:\/\/[\w-]+\.trycloudflare\.com$/;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (nodeEnv === 'development' && cloudflareDevOrigin.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
