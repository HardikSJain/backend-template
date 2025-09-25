import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class RegisterReqDto {
  @IsPhoneNumber('IN')
  @IsNotEmpty()
  phone!: string;
}
