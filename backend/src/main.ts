import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
          connectSrc: [
            "'self'",
            configService.getOrThrow<string>('FRONTEND_URL'),
          ],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: configService.getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(
    new ThrottlerExceptionFilter(),
    new GlobalExceptionFilter(),
  );
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Personal Finance API')
    .setDescription(
      'REST API for the Personal Finance Management application.\n\n' +
      '## Authentication\n' +
      'Most endpoints require a Bearer token. To authenticate:\n' +
      '1. Call `POST /api/v1/auth/register` or `POST /api/v1/auth/login`\n' +
      '2. Copy the `accessToken` from the response\n' +
      '3. Click the **Authorize** button at the top of this page\n' +
      '4. Enter: `Bearer <your-token>` in the value field\n\n' +
      '## Response Format\n' +
      'All successful responses are wrapped in:\n' +
      '```json\n{ "data": <payload>, "meta": { "timestamp": "<ISO>" } }\n```\n\n' +
      '## Money Format\n' +
      'All monetary values are returned in **dollars** (not cents). ' +
      'Example: $15.99 is returned as `15.99`.'
    )
    .setVersion('1.0')
    .setContact(
      'Finance App Team',
      'https://yourapp.com',
      'support@yourapp.com',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token. Obtain it from POST /auth/login.',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Registration, login, token refresh, Google OAuth, and 2FA')
    .addTag('Transactions', 'Create, read, update, and delete financial transactions')
    .addTag('Categories', 'Manage income and expense categories')
    .addTag('Budgets', 'Set monthly budget caps and track spending against them')
    .addTag('Calculations', 'Aggregate financial summaries by month, quarter, and year')
    .addTag('Reports', 'Download transaction data as CSV or PDF')
    .build();

  // Scanning every route to build the document is startup work, so skip it
  // when the docs are not served (keeps production cold starts shorter).
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
      },
      customSiteTitle: 'Finance API Docs',
    });
  }

  const port = configService.get<number>('port') ?? 3001;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}/api/v1`);
  console.log(`API documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
