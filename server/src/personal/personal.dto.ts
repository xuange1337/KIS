import {
  IsIn,
  IsObject,
  IsString,
  Length,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const FILTER_ENTITIES = ['clients', 'deals'] as const;
export type FilterEntity = (typeof FILTER_ENTITIES)[number];

/** Какие ключи допустимы в наборе фильтров каждого списка. */
export const ALLOWED_FILTER_KEYS: Record<FilterEntity, string[]> = {
  clients: [
    'q',
    'status',
    'source',
    'industry',
    'ownerUserId',
    'favorite',
    'tagId',
  ],
  deals: ['q', 'stage', 'ownerUserId', 'amountFrom', 'amountTo', 'favorite'],
};

@ValidatorConstraint({ name: 'filterValues', async: false })
class FilterValuesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return false;
    const entries = Object.entries(value);
    return (
      entries.length <= 10 &&
      entries.every(
        ([, item]) =>
          (typeof item === 'string' && item.length <= 200) ||
          typeof item === 'boolean' ||
          (typeof item === 'number' && Number.isFinite(item)),
      )
    );
  }
  defaultMessage(): string {
    return 'Фильтры заданы некорректно';
  }
}

export class CreateSavedFilterDto {
  @IsIn(FILTER_ENTITIES)
  entity: FilterEntity;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsObject()
  @Validate(FilterValuesConstraint)
  filters: Record<string, string | number | boolean>;
}

export class QuerySavedFiltersDto {
  @IsIn(FILTER_ENTITIES)
  entity: FilterEntity;
}

export const FAVORITE_TYPES = ['client', 'deal'] as const;
export type FavoriteType = (typeof FAVORITE_TYPES)[number];

export class QueryFavoritesDto {
  @IsIn(FAVORITE_TYPES)
  entityType: FavoriteType;
}
