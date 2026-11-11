import { DuplicateReason } from '@crm/shared';

// \b в JavaScript понимает только латиницу, поэтому границы слова заданы явно
const LEGAL_FORMS =
  /(?<![а-яa-z0-9])(ооо|зао|оао|пао|ао|ип|нко|общество с ограниченной ответственностью|индивидуальный предприниматель)(?![а-яa-z0-9])/g;

/** Наименование без кавычек, правовой формы, регистра и лишних пробелов. */
export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[«»"'`.,;:()]/g, ' ')
      .replace(LEGAL_FORMS, ' ')
      // Пробелы и дефисы убираются совсем: «ЛогистикПро» и «Логистик Про»
      // — одно и то же название, набранное по-разному
      .replace(/[\s\-–—]+/g, '')
  );
}

/** Последние десять цифр: +7 (900) 123-45-67 и 8 900 123 45 67 — один номер. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function normalizeEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  return value.includes('@') ? value : null;
}

export interface DuplicateSource {
  clientId: number;
  name: string;
  inn: string | null;
  emails: string[];
  phones: string[];
}

export interface RawDuplicateGroup {
  clientIds: number[];
  reasons: DuplicateReason[];
}

/**
 * Находит группы клиентов, связанных общим ИНН, названием, почтой
 * или телефоном контакта. Связи транзитивны: если A похож на B, а B на C,
 * то все трое показываются одной группой, иначе объединять пришлось бы
 * по кругу.
 */
export function findDuplicateGroups(
  clients: DuplicateSource[],
): RawDuplicateGroup[] {
  const parent = new Map<number, number>();
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as number;
    parent.set(id, root);
    return root;
  };
  for (const client of clients) parent.set(client.clientId, client.clientId);

  const reasonsByRoot = new Map<number, Set<DuplicateReason>>();
  const link = (a: number, b: number, reason: DuplicateReason) => {
    const rootA = find(a);
    const rootB = find(b);
    const merged = new Set([
      ...(reasonsByRoot.get(rootA) ?? []),
      ...(reasonsByRoot.get(rootB) ?? []),
      reason,
    ]);
    const root = Math.min(rootA, rootB);
    parent.set(rootA, root);
    parent.set(rootB, root);
    reasonsByRoot.delete(rootA);
    reasonsByRoot.delete(rootB);
    reasonsByRoot.set(root, merged);
  };

  const seen = new Map<string, number>();
  const visit = (key: string, id: number, reason: DuplicateReason) => {
    const prior = seen.get(key);
    if (prior === undefined) seen.set(key, id);
    else if (prior !== id) link(prior, id, reason);
  };

  for (const client of clients) {
    if (client.inn) visit(`inn:${client.inn.trim()}`, client.clientId, 'inn');
    const name = normalizeName(client.name);
    if (name.length >= 3) visit(`name:${name}`, client.clientId, 'name');
    for (const email of client.emails)
      visit(`email:${email}`, client.clientId, 'email');
    for (const phone of client.phones)
      visit(`phone:${phone}`, client.clientId, 'phone');
  }

  const groups = new Map<number, number[]>();
  for (const client of clients) {
    const root = find(client.clientId);
    groups.set(root, [...(groups.get(root) ?? []), client.clientId]);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([root, ids]) => ({
      clientIds: ids.sort((a, b) => a - b),
      reasons: [...(reasonsByRoot.get(root) ?? [])],
    }))
    .sort((a, b) => a.clientIds[0] - b.clientIds[0]);
}
