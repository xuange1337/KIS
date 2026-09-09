import { ActivityStatus, ActivityType } from '@crm/shared';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateActivityDto {
  @IsInt()
  clientId: number;

  @IsOptional()
  @IsInt()
  dealId?: number | null;

  @IsEnum(ActivityType)
  type: ActivityType;

  @IsString()
  @Length(2, 255)
  subject: string;

  @IsDateString({}, { message: 'Некорректные дата и время активности' })
  plannedAt: string;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @IsString()
  result?: string | null;

  @IsOptional()
  @IsString()
  comment?: string | null;

  @IsOptional()
  @IsInt()
  ownerUserId?: number | null;
}
