import { StringField } from '@/decorators/field.decorators';
import { IsNotEmpty } from 'class-validator';

export class LoginReqDto {
  @StringField({ description: 'Country calling code', example: '+91' })
  @IsNotEmpty()
  countryCode!: string;

  @StringField({
    description: 'Local phone number without country code',
    example: '9876543210',
  })
  @IsNotEmpty()
  phone!: string;

  @StringField({
    minLength: 4,
    maxLength: 6,
    description: 'One-time password',
    example: '1234',
  })
  otp!: string;
}
