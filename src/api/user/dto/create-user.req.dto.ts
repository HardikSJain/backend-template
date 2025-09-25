import {
  StringField,
  StringFieldOptional,
} from '@/decorators/field.decorators';
import { lowerCaseTransformer } from '@/utils/transformers/lower-case.transformer';
import { Transform } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class CreateUserReqDto {
  @StringField()
  @Transform(lowerCaseTransformer)
  username: string;

  @StringField({ description: 'Country calling code', example: '+91' })
  @IsNotEmpty()
  countryCode: string;

  @StringField({
    description: 'Local phone number without country code',
    example: '9876543210',
  })
  @IsNotEmpty()
  phone: string;

  @StringFieldOptional()
  bio?: string;

  @StringFieldOptional()
  image?: string;
}
