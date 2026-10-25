import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';

const baseUrl = process.env.NIR_URL ?? 'http://127.0.0.1:8181';
if (baseUrl !== 'http://127.0.0.1:8181') {
  throw new Error(
    'The benchmark targets the isolated localhost:8181 stand only',
  );
}
const requests = Number(process.env.NIR_REQUESTS ?? 50);
const repeats = Number(process.env.NIR_REPEATS ?? 3);
if (
  !Number.isInteger(requests) ||
  requests < 10 ||
  requests > 1000 ||
  !Number.isInteger(repeats) ||
  repeats < 1 ||
  repeats > 10
)
  throw new Error('NIR_REQUESTS=10..1000 and NIR_REPEATS=1..10 required');

const routes = [
  '/api/clients?limit=25',
  '/api/deals?limit=25',
  '/api/activities?limit=25',
  '/api/dashboard',
  '/api/reports/funnel?currency=RUB',
  '/api/clients?limit=25&q=100',
];
const deadline = () => AbortSignal.timeout(15_000);
const sessions = [];
for (let i = 1; i <= 30; i++) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: `nir_${i}`, password: 'nir-test-only' }),
    signal: deadline(),
  });
  if (!response.ok)
    throw new Error(`Fixture login ${i}: HTTP ${response.status}`);
  const body = await response.json();
  if (!body.accessToken)
    throw new Error('Login did not return an access token');
  sessions.push({ Authorization: `Bearer ${body.accessToken}` });
}

// Nearest-rank percentile, with nonempty samples and full response download.
const summarize = (samples) => {
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const percentile = (p) => times[Math.max(0, Math.ceil(times.length * p) - 1)];
  const round = (n) => Number(n.toFixed(2));
  return {
    requests: times.length,
    errors: samples.filter((s) => s.error).length,
    p50Ms: round(percentile(0.5)),
    p95Ms: round(percentile(0.95)),
    maxMs: round(times.at(-1)),
  };
};
const call = async (route, headers) => {
  const started = performance.now();
  let status = 0;
  let error = false;
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      headers,
      signal: deadline(),
    });
    status = response.status;
    const body = await response.json();
    error = !response.ok || body === null || typeof body !== 'object';
  } catch {
    error = true;
  }
  return { route, ms: performance.now() - started, status, error };
};

const runs = [];
for (const concurrency of [1, 10, 30]) {
  // All organizations and roles participate even in the single-worker run.
  for (const [i, headers] of sessions.entries()) {
    const sample = await call(routes[i % routes.length], headers);
    if (sample.error)
      throw new Error(`Warmup failed: ${sample.route}, ${sample.status}`);
  }
  for (let repeat = 1; repeat <= repeats; repeat++) {
    const started = performance.now();
    const groups = await Promise.all(
      Array.from({ length: concurrency }, async (_, worker) => {
        const samples = [];
        for (let i = 0; i < requests; i++) {
          samples.push(
            await call(
              routes[(worker + i) % routes.length],
              sessions[(worker + i) % sessions.length],
            ),
          );
        }
        return samples;
      }),
    );
    const elapsedSeconds = (performance.now() - started) / 1000;
    const samples = groups.flat();
    const metrics = summarize(samples);
    const run = {
      concurrency,
      repeat,
      ...metrics,
      elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
      rps: Number((samples.length / elapsedSeconds).toFixed(2)),
      errorRate: metrics.errors / samples.length,
      routes: Object.fromEntries(
        routes.map((route) => [
          route,
          summarize(samples.filter((s) => s.route === route)),
        ]),
      ),
      samples,
    };
    runs.push(run);
    process.stdout.write(
      `${JSON.stringify({ ...run, samples: undefined, routes: undefined })}\n`,
    );
  }
}
const report = {
  date: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  workingTreeModified: true,
  node: process.version,
  host: {
    platform: platform(),
    release: release(),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
  },
  baseUrl,
  requestsPerWorker: requests,
  repeats,
  model:
    'closed-loop; no think time; login excluded; warmup 30 sequential requests per concurrency; mixed roles and organizations',
  routes,
  p95BudgetMs: 800,
  runs,
};
const output = process.argv[2];
if (!output) throw new Error('Pass a JSON output path');
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
if (runs.some((r) => r.errors || r.p95Ms > report.p95BudgetMs))
  process.exitCode = 1;
