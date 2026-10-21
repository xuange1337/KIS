import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT } from './mail.transport';
import { SmtpTransport } from './smtp.transport';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new SmtpTransport(config.get('mail', { infer: true })),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
