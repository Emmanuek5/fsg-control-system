import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/public.decorator';
import { NombaWebhooksService } from './nomba-webhooks.service';
import { MonnifyWebhooksService } from './monnify-webhooks.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly nomba: NombaWebhooksService, private readonly monnify: MonnifyWebhooksService) {}

  @Public()
  @Get('nomba')
  nombaWebhookHealth() {
    return this.nomba.health();
  }

  @Public()
  @Post('nomba')
  @HttpCode(200)
  nombaWebhook(
    @Body() body: unknown,
    @Req() req: RawBodyRequest,
    @Headers('nomba-signature') signature?: string,
    @Headers('nomba-signature-algorithm') algorithm?: string,
    @Headers('nomba-signature-version') version?: string,
    @Headers('nomba-timestamp') timestamp?: string,
  ) {
    return this.nomba.handleWebhook(body, req.rawBody, { signature, algorithm, version, timestamp });
  }
  @Public()
  @Get('monnify')
  monnifyWebhookHealth() {
    return this.monnify.health();
  }

  @Public()
  @Post('monnify')
  @HttpCode(200)
  monnifyWebhook(@Body() body: unknown, @Req() req: RawBodyRequest, @Headers('monnify-signature') signature?: string) {
    return this.monnify.handleWebhook(body, req.rawBody, signature);
  }
}

