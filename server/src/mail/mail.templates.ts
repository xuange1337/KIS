import { MailMessage } from './mail.transport';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Общая оболочка письма: имя в шапке, кнопка-ссылка, примечание. */
const layout = (
  title: string,
  paragraphs: string[],
  action: { label: string; url: string },
  footnote: string,
): Pick<MailMessage, 'html' | 'text'> => {
  const html = `<!doctype html>
<html lang="ru"><body style="font-family:Arial,sans-serif;color:#1b1f23;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>
${paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#1565c0;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block">${escapeHtml(action.label)}</a></p>
<p style="font-size:13px;color:#57606a;line-height:1.5">Если кнопка не работает, скопируйте ссылку в браузер:<br>${escapeHtml(action.url)}</p>
<p style="font-size:12px;color:#8c959f;line-height:1.5">${escapeHtml(footnote)}</p>
</body></html>`;
  const text = [
    title,
    '',
    ...paragraphs,
    '',
    `${action.label}: ${action.url}`,
    '',
    footnote,
  ].join('\n');
  return { html, text };
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TZ ?? 'Europe/Moscow',
  });

export const invitationMail = (params: {
  to: string;
  organizationName: string;
  roleLabel: string;
  inviterName: string | null;
  url: string;
  expiresAt: string;
}): MailMessage => {
  const who = params.inviterName
    ? `${params.inviterName} приглашает вас`
    : 'Вас приглашают';
  const title = `Приглашение в «${params.organizationName}»`;
  return {
    to: params.to,
    subject: title,
    ...layout(
      title,
      [
        `${who} в CRM организации «${params.organizationName}» с ролью «${params.roleLabel}».`,
        `Логин и пароль вы придумаете сами. Ссылка действует до ${formatDate(params.expiresAt)} и срабатывает один раз.`,
      ],
      { label: 'Принять приглашение', url: params.url },
      'Если вы не ожидали это письмо, просто проигнорируйте его.',
    ),
  };
};

export const passwordResetMail = (params: {
  to: string;
  url: string;
  expiresAt: string;
}): MailMessage => ({
  to: params.to,
  subject: 'Установка пароля',
  ...layout(
    'Установка пароля',
    [
      'Для вашей учётной записи запрошена установка нового пароля.',
      `Ссылка действует до ${formatDate(params.expiresAt)} и срабатывает один раз.`,
    ],
    { label: 'Задать пароль', url: params.url },
    'Если вы не запрашивали смену пароля, проигнорируйте письмо: текущий пароль останется прежним.',
  ),
});
