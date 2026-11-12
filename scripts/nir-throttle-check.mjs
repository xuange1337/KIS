import { writeFile } from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:8181';
const response = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'nir_3', password: 'nir-test-only' }),
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error(`Login: ${response.status}`);
const { accessToken } = await response.json();
const statuses = {};
let firstRejectedRequest = null;
for (let i = 1; i <= 130; i++) {
  const r = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  await r.arrayBuffer();
  statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  if (r.status === 429 && firstRejectedRequest === null)
    firstRejectedRequest = i;
}
const result = {
  date: new Date().toISOString(),
  route: '/api/dashboard',
  requests: 130,
  statuses,
  firstRejectedRequest,
};
await writeFile(process.argv[2], `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (statuses[200] !== 120 || statuses[429] !== 10) process.exitCode = 1;
