import { Module } from '@nestjs/common';
import { EmailQueueModule } from './queues/email-queue/email-queue.module';
import { OtpQueueModule } from './queues/otp-queue/otp-queue.module';
@Module({
  imports: [EmailQueueModule, OtpQueueModule],
})
export class BackgroundModule {}
