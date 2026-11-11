import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import {
  RecordType,
  useAddComment,
  useComments,
  useDeleteComment,
} from '../../api/hooks';
import { formatDateTime } from '../../components/formatters';
import { useAuth } from '../auth/AuthContext';

/** Комментарии команды к клиенту или сделке, новые сверху. */
export function CommentsPanel({ type, id }: { type: RecordType; id: number }) {
  const { user, canSeeAll } = useAuth();
  const { data: comments, isError } = useComments(type, id);
  const add = useAddComment(type, id);
  const remove = useDeleteComment(type, id);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    setError('');
    try {
      await add.mutateAsync(value);
      setBody('');
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось отправить комментарий'));
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Комментарии{comments ? ` (${comments.length})` : ''}
      </Typography>
      <form onSubmit={submit}>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {(error || isError) && (
            <Alert severity="error">
              {error || 'Не удалось загрузить комментарии'}
            </Alert>
          )}
          <TextField
            label="Новый комментарий"
            multiline
            minRows={2}
            fullWidth
            value={body}
            onChange={(event) => setBody(event.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={!body.trim() || add.isPending}
            >
              Отправить
            </Button>
          </Box>
        </Stack>
      </form>
      {comments && comments.length === 0 && (
        <Typography color="text.secondary" variant="body2">
          Комментариев пока нет. Оставьте заметку для коллег: ответственный
          получит уведомление.
        </Typography>
      )}
      <Stack spacing={1.5}>
        {comments?.map((comment) => (
          <Box key={comment.commentId}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {comment.authorName ?? 'Бывший сотрудник'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(comment.createdAt)}
              </Typography>
              {(canSeeAll || comment.authorUserId === user?.userId) && (
                <IconButton
                  size="small"
                  aria-label="Удалить комментарий"
                  onClick={() => remove.mutate(comment.commentId)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
              {comment.body}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
