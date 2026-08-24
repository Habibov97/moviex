import { Module } from '@nestjs/common';

import { EmailService } from './email.service';

/**
 * Nothing but the transport. Kept separate from `AuthModule` because "send an
 * email" is not an auth concern — the next thing that needs one (a password
 * reset, a digest) imports this rather than reaching into auth.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class MailModule {}
