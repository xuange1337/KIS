import { config as loadEnvFile } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import type { JwtSignOptions } from '@nestjs/jwt';

/**
 * Загружает .env из корня монорепозитория.
 *
 * Точек входа несколько — сервер, CLI миграций, seed, e2e-тесты — и каждая
 * запускается из своего каталога. Без явной загрузки часть из них работала бы
 * на значениях по умолчанию, а не на настройках стенда.
 * В контейнере переменные приходят из окружения, файла там нет — это нормально.
 */
const loadRootEnv = (): void => {
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      loadEnvFile({ path: candidate });
      return;
    }
    dir = join(dir, '..');
  }
};

loadRootEnv();

/**
 * Срок жизни токена в формате библиотеки jsonwebtoken ('15m', '7d', число секунд).
 * Значение приходит из переменных окружения строкой, поэтому приводится
 * к типу библиотеки один раз здесь, а не в каждом месте подписи токена.
 */
type TokenTtl = JwtSignOptions['expiresIn'];

/** Минимальная длина секрета подписи токенов, символов. */
const MIN_SECRET_LENGTH = 32;

/** Читает обязательную переменную окружения без требований к длине. */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Переменная окружения ${name} не задана.`);
  }
  return value;
};

/**
 * Читает обязательную переменную окружения.
 * Значения по умолчанию для секретов недопустимы: с ними приложение
 * молча подписывало бы токены общеизвестным ключом, и любой, кто видел
 * исходники, выпустил бы себе токен администратора.
 */
const requireSecret = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Переменная окружения ${name} не задана. ` +
        `Сгенерируйте секрет командой: openssl rand -hex 32`,
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Переменная окружения ${name} короче ${MIN_SECRET_LENGTH} символов. ` +
        `Сгенерируйте секрет командой: openssl rand -hex 32`,
    );
  }
  return value;
};

/** Конфигурация приложения, собираемая из переменных окружения. */
export interface AppConfig {
  nodeEnv: string;
  apiPort: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: TokenTtl;
    refreshTtl: TokenTtl;
    /** Передавать refresh-cookie только по HTTPS. */
    cookieSecure: boolean;
  };
  uploadsDir: string;
}

export const configuration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPort: Number(process.env.API_PORT ?? 3000),
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    name: process.env.POSTGRES_DB ?? 'crm',
    user: process.env.POSTGRES_USER ?? 'crm',
    // Пароль базы обязателен так же, как секреты токенов: значение по
    // умолчанию в исходниках означает, что оно известно всем
    password: requireEnv('POSTGRES_PASSWORD'),
  },
  jwt: {
    accessSecret: requireSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    accessTtl: (process.env.JWT_ACCESS_TTL ?? '15m') as TokenTtl,
    refreshTtl: (process.env.JWT_REFRESH_TTL ?? '7d') as TokenTtl,
    // Не выводится из NODE_ENV: production-развёртывание по HTTP —
    // обычный сценарий демонстрации, а Secure-cookie браузер там отбросит,
    // и сессия перестанет восстанавливаться после перезагрузки страницы
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
});
