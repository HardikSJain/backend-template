export interface IEmailJob {
  email: string;
}

export interface IVerifyEmailJob extends IEmailJob {
  token: string;
}

export interface IOtpJob {
  phone: string;
  otp: string;
  channel?: 'whatsapp' | 'sms';
}
