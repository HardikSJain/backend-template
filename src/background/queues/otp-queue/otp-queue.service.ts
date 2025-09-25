import { IOtpJob } from '@/common/interfaces/job.interface';
import { JobName, QueueName } from '@/constants/job.constant';
import { Msg91Service } from '@/libs/msg91/msg91.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class OtpQueueService {
  private readonly logger = new Logger(OtpQueueService.name);

  constructor(
    private readonly msg91: Msg91Service,
    @InjectQueue(QueueName.OTP) private readonly otpQueue: Queue,
  ) {}

  async enqueueSendOtp(data: IOtpJob) {
    this.logger.debug(
      `Enqueuing OTP for ${data.phone} via ${data.channel ?? 'whatsapp'}`,
    );
    await this.otpQueue.add(JobName.SEND_OTP, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
      },
    });
  }

  async sendOtp(data: IOtpJob) {
    this.logger.debug(
      `Sending OTP to ${data.phone} via ${data.channel ?? 'whatsapp'}`,
    );
    await this.msg91.sendOtp(data.phone, data.otp, data.channel ?? 'whatsapp');
  }
}
