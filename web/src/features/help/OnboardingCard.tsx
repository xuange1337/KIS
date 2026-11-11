import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivities, useClients, useDeals } from '../../api/hooks';

const DISMISS_KEY = 'crm.onboarding.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Первые шаги для нового пользователя. Исчезает сама, когда все шаги
 * выполнены, и по кнопке «Скрыть»; хранилище браузера может быть закрыто,
 * поэтому его недоступность не должна ломать главную.
 */
export function OnboardingCard() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(readDismissed);
  const clients = useClients({ page: 1, limit: 1 });
  const deals = useDeals({ page: 1, limit: 1 });
  const activities = useActivities({ page: 1, limit: 1 });

  if (dismissed || !clients.data || !deals.data || !activities.data)
    return null;
  const steps = [
    {
      label: 'Добавьте первого клиента',
      done: clients.data.total > 0,
      to: '/clients',
    },
    { label: 'Создайте сделку', done: deals.data.total > 0, to: '/deals' },
    {
      label: 'Запланируйте активность',
      done: activities.data.total > 0,
      to: '/calendar',
    },
  ];
  if (steps.every((step) => step.done)) return null;

  const hide = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* хранилище недоступно: скрываем только до перезагрузки */
    }
    setDismissed(true);
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6">С чего начать</Typography>
          <Button size="small" onClick={hide}>
            Скрыть
          </Button>
        </Stack>
        <Alert severity="info" sx={{ my: 1 }}>
          Три шага, после которых раздел «Обзор» наполнится данными. Подробности
          — в разделе «Справка».
        </Alert>
        {steps.map((step) => (
          <Stack
            key={step.label}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ py: 0.5 }}
          >
            {step.done ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <RadioButtonUncheckedIcon fontSize="small" />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{ textDecoration: step.done ? 'line-through' : 'none' }}
              >
                {step.label}
              </Typography>
            </Box>
            {!step.done && (
              <Button size="small" onClick={() => navigate(step.to)}>
                Перейти
              </Button>
            )}
          </Stack>
        ))}
      </CardContent>
    </Card>
  );
}
