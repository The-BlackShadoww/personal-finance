import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../../common/money/locale';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ashikur Rahman', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Publicly accessible URL to a profile image',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl must be a valid URL' })
  @MaxLength(500)
  avatarUrl?: string;
  // We store a URL, not the image itself.
  // Image upload (to S3/Cloudflare R2) is a Phase 2 feature.
  // For now, the user pastes a public image URL.

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'Asia/Dhaka',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code used to display money',
    example: 'BDT',
  })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES, { message: 'currency must be a supported ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'BCP 47 locale used to format numbers and dates',
    example: 'en-BD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(35)
  locale?: string;
}
