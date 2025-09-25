import { Injectable } from '@nestjs/common';

export type Msg91Channel = 'whatsapp' | 'sms';

@Injectable()
export class Msg91Service {
  private readonly authKey = process.env.MSG91_AUTH_KEY;
  private readonly whatsappTemplateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;
  private readonly smsTemplateId = process.env.MSG91_SMS_TEMPLATE_ID;

  async sendOtp(
    phone: string,
    otp: string,
    channel: Msg91Channel = 'whatsapp',
  ): Promise<void> {
    if (channel === 'whatsapp') {
      await this.sendWhatsappOtp(phone, otp);
    } else {
      await this.sendSmsOtp(phone, otp);
    }
  }

  private async sendWhatsappOtp(phone: string, otp: string): Promise<void> {
    // TODO: Implement Msg91 API
    // Implement WhatsApp OTP send via Msg91 API
    // await axios.post('https://api.msg91.com/api/v5/whatsapp/otp', {
    //   template_id: this.whatsappTemplateId,
    //   authkey: this.authKey,
    //   mobile: phone,
    //   otp,
    // });
  }

  private async sendSmsOtp(phone: string, otp: string): Promise<void> {
    // TODO: Implement Msg91 API
    // Implement SMS OTP send via Msg91 API
    // await axios.post('https://api.msg91.com/api/v5/otp', {
    //   template_id: this.smsTemplateId,
    //   authkey: this.authKey,
    //   mobile: phone,
    //   otp,
    // });
  }
}
