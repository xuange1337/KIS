import axe, { Result } from 'axe-core';

/**
 * Проверка разметки на нарушения доступности.
 *
 * Проверяется то, что видно в разметке: подписи полей, роли, доступные
 * имена кнопок, порядок заголовков. Контрастность здесь не проверяется —
 * в jsdom нет вычисленных цветов, и правило не отрабатывает; за неё
 * отвечает ревью макетов и токены темы.
 *
 * Нарушения уровня serious и critical считаются ошибкой: они означают,
 * что элементом нельзя воспользоваться с клавиатуры или через
 * экранный диктор, а не что разметку можно написать аккуратнее.
 */
export async function expectNoAccessibilityViolations(
  container: HTMLElement,
): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });

  const serious = results.violations.filter(
    (violation: Result) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );

  if (serious.length > 0) {
    const report = serious
      .map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.help}\n` +
          violation.nodes
            .map((node) => `    ${node.html}`)
            .slice(0, 3)
            .join('\n'),
      )
      .join('\n');
    throw new Error(`Нарушения доступности:\n${report}`);
  }
}
