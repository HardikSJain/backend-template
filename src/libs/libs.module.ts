import { Module } from '@nestjs/common';
import { AwsModule } from './aws/aws.module';
import { GcpModule } from './gcp/gcp.module';
import { Msg91Module } from './msg91/msg91.module';

@Module({
  imports: [AwsModule, GcpModule, Msg91Module],
  exports: [Msg91Module],
})
export class LibsModule {}
