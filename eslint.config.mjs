import js from '@eslint/js';
import globals from 'globals';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Единая конфигурация линтера для сервера, клиента и общего пакета.
 *
 * Набор намеренно узкий: правила, которые ловят ошибки, а не стиль.
 * Форматирование остаётся за Prettier, и дублировать его правилами
 * линтера значит получить два источника правды и спорящие автофиксы.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'docs/**',
      'packages/*/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Неиспользуемое — обычно забытый код или опечатка в имени.
      // Осознанно неиспользуемый аргумент помечается подчёркиванием
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // any отключает проверку типов в месте, где она нужнее всего,
      // но в интеграционном коде (request Express, raw-строки TypeORM)
      // он неизбежен, поэтому предупреждение, а не ошибка
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Проверку объявлений в TypeScript делает компилятор; правило
      // линтера дублирует её и ложно срабатывает на глобальных типах
      'no-undef': 'off',
      // Неразрывный пробел встречается в регулярных выражениях
      // осознанно: русское форматирование чисел разделяет разряды именно им
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Скрипты выполняются в Node напрямую, без сборки
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Скрипты и тесты выводят результат в консоль — это их назначение
    files: [
      'scripts/**/*.mjs',
      'server/test/**/*.ts',
      'server/src/database/seeds/**/*.ts',
      'server/src/openapi-export.ts',
      'docs/**/*.mjs',
    ],
    rules: { 'no-console': 'off' },
  },
);
