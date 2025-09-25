import { IOtpJob } from '@/common/interfaces/job.interface';
import { JobName, QueueName } from '@/constants/job.constant';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OtpQueueService } from './otp-queue.service';

@Injectable()
@Processor(QueueName.OTP, {
  concurrency: 2,
  drainDelay: 300,
  stalledInterval: 300000,
  removeOnComplete: {
    age: 86400,
    count: 100,
  },
  limiter: {
    max: 5,
    duration: 1000,
  },
})
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);
  constructor(private readonly otpQueueService: OtpQueueService) {
    super();
  }

  async process(job: Job<IOtpJob, any, string>): Promise<any> {
    this.logger.debug(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );

    if (job.name === JobName.SEND_OTP) {
      return await this.otpQueueService.sendOtp(job.data);
    }

    throw new Error(`Unknown job name: ${job.name}`);
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job) {
    const progress = typeof job.progress === 'number' ? job.progress : 0;
    this.logger.debug(`Job ${job.id} is ${progress}% complete`);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} has been completed`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job) {
    this.logger.error(
      `Job ${job.id} has failed with reason: ${job.failedReason}`,
    );
    if (job.stacktrace) {
      this.logger.error(job.stacktrace.join('\n'));
    }
  }

  @OnWorkerEvent('stalled')
  async onStalled(job: Job) {
    this.logger.error(`Job ${job.id} has been stalled`);
  }

  @OnWorkerEvent('error')
  async onError(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} has failed with error: ${error.message}`);
  }
}
