import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateTagDto {
  @IsString()
  @Length(1, 40)
  name: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Цвет задаётся как #RRGGBB' })
  color: string;
}

export class UpdateTagDto {
  @IsString()
  @Length(1, 40)
  name: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Цвет задаётся как #RRGGBB' })
  color: string;
}

export class SetClientTagsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tagIds: number[];
}

export class TagClientsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  clientIds: number[];
}
