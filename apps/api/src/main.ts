import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
loadEnv();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  // Allow the configured web origin plus any local/LAN origin during dev, so the
  // app works whether opened via localhost, 127.0.0.1, or the machine's LAN IP.
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/;
  // WEB_ORIGIN may be a comma-separated list; compare ignoring trailing slashes and case.
  const normalizeOrigin = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
  const allowedOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin)) || localOrigin.test(origin)) {
        return callback(null, true);
      }
      Logger.warn(
        `CORS rejected origin "${origin}" (WEB_ORIGIN allows: ${allowedOrigins.join(', ') || 'nothing'})`,
        'Bootstrap',
      );
      return callback(null, false);
    },
    credentials: true,
  });

  // Serve uploaded files at /uploads/<filename>
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FSG Control System API')
    .setDescription('Management portal API for FSG Work Solutions')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 4000);
  // Bind all interfaces so Docker healthchecks and reverse proxies can reach us.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API running on http://0.0.0.0:${port}/api (docs at /api/docs)`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
