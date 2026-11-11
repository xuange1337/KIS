import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PageHeader } from '../components/PageHeader';

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl+K или ⌘K', 'Поиск по всем разделам'],
  ['?', 'Открыть эту справку'],
  ['Alt+1 … Alt+9', 'Перейти в раздел меню по порядку'],
  ['Esc', 'Закрыть окно или поиск'],
];

const TOPICS: Array<{ title: string; body: string[] }> = [
  {
    title: 'Клиенты: поиск дублей и объединение',
    body: [
      'Раздел «Клиенты» → «Поиск дублей». Система сравнивает ИНН, название без правовой формы, почту и телефон контактов.',
      'В группе выберите основную карточку и нажмите «Объединить»: контакты, сделки и активности перейдут в неё, пустые поля заполнятся, дубли удалятся.',
    ],
  },
  {
    title: 'Метки, избранное и сохранённые фильтры',
    body: [
      'Метки создаёт руководитель (кнопка «Метки»). Ставятся в карточке клиента или сразу нескольким отмеченным клиентам.',
      'Звёздочка добавляет клиента или сделку в избранное, а чип «Только избранные» оставляет в списке только их.',
      'Нажмите «Сохранить текущие» над фильтрами, чтобы вернуть эту выборку одним кликом.',
    ],
  },
  {
    title: 'Сделки: состав, воронки, поля',
    body: [
      'В карточке сделки «Изменить состав» добавляет товары и услуги из каталога; сумма сделки считается по ним.',
      'Воронки (кнопка «Воронки» у руководителя) задают набор стадий под разные процессы продаж; в списке и на доске можно выбрать нужную.',
      'Собственные поля клиентов и сделок настраиваются кнопкой «Поля».',
    ],
  },
  {
    title: 'Уведомления, комментарии, чек-листы',
    body: [
      'Колокольчик в меню показывает просроченные и ближайшие активности, назначения и комментарии коллег.',
      'В карточках клиента и сделки есть чек-лист для подзадач и комментарии для заметок команды.',
    ],
  },
  {
    title: 'Аналитика',
    body: [
      'Раздел «Аналитика»: прогноз поступлений по месяцам, конверсия между стадиями и рейтинг менеджеров за выбранный период.',
    ],
  },
];

/** Встроенная справка и список горячих клавиш. */
export function HelpPage() {
  return (
    <>
      <PageHeader
        title="Справка"
        subtitle="Как пользоваться основными возможностями"
      />
      <Box sx={{ mb: 3 }}>
        {TOPICS.map((topic, index) => (
          <Accordion key={topic.title} defaultExpanded={index === 0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>{topic.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {topic.body.map((line) => (
                <Typography key={line} variant="body2" sx={{ mb: 1 }}>
                  {line}
                </Typography>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Горячие клавиши
      </Typography>
      <Table size="small" sx={{ maxWidth: 520 }}>
        <TableBody>
          {SHORTCUTS.map(([keys, action]) => (
            <TableRow key={keys}>
              <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {keys}
              </TableCell>
              <TableCell>{action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
