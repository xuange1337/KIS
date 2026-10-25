/**
 * Минимальный реестр метрик в формате Prometheus.
 *
 * Библиотека метрик ради трёх счётчиков и одной гистограммы добавила бы
 * зависимость с собственным набором уязвимостей и лицензий, а формат
 * текстовой выдачи прост и стабилен.
 */

type Labels = Record<string, string>;

const escapeLabel = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

const labelKey = (labels: Labels): string =>
  Object.keys(labels)
    .sort()
    .map((name) => `${name}="${escapeLabel(labels[name])}"`)
    .join(',');

/** Предел числа комбинаций меток: защита от бесконечного роста памяти. */
const MAX_SERIES = 2000;

class Counter {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  inc(labels: Labels = {}, by = 1): void {
    const key = labelKey(labels);
    if (!this.values.has(key) && this.values.size >= MAX_SERIES) return;
    this.values.set(key, (this.values.get(key) ?? 0) + by);
  }

  render(): string[] {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [key, value] of this.values) {
      lines.push(`${this.name}${key ? `{${key}}` : ''} ${value}`);
    }
    return lines;
  }
}

class Histogram {
  private readonly series = new Map<
    string,
    { buckets: number[]; sum: number; count: number }
  >();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly bounds: number[],
  ) {}

  observe(labels: Labels, value: number): void {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      if (this.series.size >= MAX_SERIES) return;
      entry = { buckets: this.bounds.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    this.bounds.forEach((bound, index) => {
      if (value <= bound) entry.buckets[index] += 1;
    });
    entry.sum += value;
    entry.count += 1;
  }

  render(): string[] {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const [key, entry] of this.series) {
      const prefix = key ? `${key},` : '';
      this.bounds.forEach((bound, index) => {
        lines.push(
          `${this.name}_bucket{${prefix}le="${bound}"} ${entry.buckets[index]}`,
        );
      });
      lines.push(`${this.name}_bucket{${prefix}le="+Inf"} ${entry.count}`);
      lines.push(`${this.name}_sum${key ? `{${key}}` : ''} ${entry.sum}`);
      lines.push(`${this.name}_count${key ? `{${key}}` : ''} ${entry.count}`);
    }
    return lines;
  }
}

/** Значение, вычисляемое в момент запроса метрик. */
export interface GaugeSample {
  name: string;
  help: string;
  samples: Array<{ labels?: Labels; value: number }>;
}

export const httpRequests = new Counter(
  'crm_http_requests_total',
  'Обработанные HTTP-запросы по методу, маршруту и статусу',
);

export const httpDuration = new Histogram(
  'crm_http_request_duration_seconds',
  'Длительность обработки HTTP-запроса',
  [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
);

export const mailSent = new Counter(
  'crm_mail_total',
  'Отправленные письма по результату',
);

export const jobRuns = new Counter(
  'crm_job_runs_total',
  'Запуски фоновых заданий по имени и результату',
);

/** Собирает текстовую выдачу из счётчиков и вычисляемых показателей. */
export const renderMetrics = (gauges: GaugeSample[]): string => {
  const lines: string[] = [
    ...httpRequests.render(),
    ...httpDuration.render(),
    ...mailSent.render(),
    ...jobRuns.render(),
  ];
  for (const gauge of gauges) {
    lines.push(
      `# HELP ${gauge.name} ${gauge.help}`,
      `# TYPE ${gauge.name} gauge`,
    );
    for (const sample of gauge.samples) {
      const key = sample.labels ? labelKey(sample.labels) : '';
      lines.push(`${gauge.name}${key ? `{${key}}` : ''} ${sample.value}`);
    }
  }
  return `${lines.join('\n')}\n`;
};
