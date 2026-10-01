import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ASSET_CLASSES, type AssetClass } from '../../accounts/account-kinds';

export class TargetShareDto {
  @ApiProperty({ enum: ASSET_CLASSES, example: 'equity' })
  @IsEnum(ASSET_CLASSES)
  assetClass!: AssetClass;

  @ApiProperty({ description: 'Percent of invested money', example: 60 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent!: number;
}

export class SetTargetAllocationDto {
  @ApiProperty({
    type: [TargetShareDto],
    description:
      'The whole target mix; shares must add up to 100. An empty list clears the target.',
  })
  @IsArray()
  @ArrayMaxSize(ASSET_CLASSES.length)
  @ValidateNested({ each: true })
  @Type(() => TargetShareDto)
  targets!: TargetShareDto[];
}
