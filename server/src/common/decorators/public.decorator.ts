import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Помечает маршрут доступным без авторизации (логин, refresh, healthcheck). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
