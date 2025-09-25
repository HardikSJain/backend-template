import { QueueName, QueuePrefix } from '@/constants/job.constant';
import { LibsModule } from '@/libs/libs.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OtpQueueEvents } from './otp-queue.events';
import { OtpQueueService } from './otp-queue.service';
import { OtpProcessor } from './otp.processor';

@Module({
  imports: [
    LibsModule,
    BullModule.registerQueue({
      name: QueueName.OTP,
      prefix: QueuePrefix.AUTH,
      streams: {
        events: {
          maxLen: 1000,
        },
      },
    }),
  ],
  providers: [OtpQueueService, OtpProcessor, OtpQueueEvents],
})
export class OtpQueueModule {}
