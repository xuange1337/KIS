import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { ImportPreview, ImportResult } from '@crm/shared';
import { ChangeEvent, useRef, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client';
import { TOKENS } from '../../theme/tokens';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Загрузка клиентской базы из файла.
 *
 * Два шага: сначала показывается, что именно будет создано и какие
 * строки отбракованы, и только потом идёт запись. Импорт «сразу» удобен
 * ровно один раз — пока в файле не окажется кривых строк, а разбирать
 * их постфактум в уже загруженной базе некому.
 */
export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName('');
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post<ImportPreview>(
        '/clients/import/preview',
        form,
      );
      setPreview(response.data);
    } catch (caught) {
      setPreview(null);
      setError(extractErrorMessage(caught, 'Не удалось разобрать файл'));
    } finally {
      setBusy(false);
      // Сброс значения: повторный выбор того же файла иначе не вызовет
      // обработчик, и исправленный файл не загрузится
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const rows = preview.rows.filter((row) => row.errors.length === 0);
      const response = await api.post<ImportResult>('/clients/import', {
        rows,
      });
      setResult(response.data);
      setPreview(null);
      onImported();
    } catch (caught) {
      setError(extractErrorMessage(caught, 'Не удалось загрузить клиентов'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>Загрузка клиентов из файла</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Файл CSV или XLSX с колонками «Наименование», «ИНН», «Отрасль»,
            «Статус», «Источник», «Адрес». Обязательна только первая; заголовки
            распознаются по названию.
          </Typography>

          <Box>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFile}
              style={{ display: 'none' }}
              aria-label="Файл для загрузки"
            />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Выбрать файл
            </Button>
            {fileName && (
              <Typography component="span" variant="body2" sx={{ ml: 1.5 }}>
                {fileName}
              </Typography>
            )}
          </Box>

          {busy && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}

          {result && (
            <Alert severity={result.skipped > 0 ? 'warning' : 'success'}>
              Загружено карточек: {result.created}
              {result.skipped > 0 ? `, пропущено: ${result.skipped}` : ''}
            </Alert>
          )}

          {preview && (
            <>
              <Stack direction="row" spacing={1}>
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`Готовы к загрузке: ${preview.validCount}`}
                />
                {preview.errorCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`С ошибками: ${preview.errorCount}`}
                  />
                )}
              </Stack>

              <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Строка</TableCell>
                      <TableCell>Наименование</TableCell>
                      <TableCell>ИНН</TableCell>
                      <TableCell>Замечания</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.line}>
                        <TableCell className="tabular">{row.line}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="tabular">
                          {row.inn ?? '—'}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: row.errors.length
                              ? TOKENS.danger
                              : TOKENS.textMuted,
                          }}
                        >
                          {row.errors.length > 0
                            ? row.errors.join('; ')
                            : 'Будет загружен'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={busy}>
          Закрыть
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={busy || !preview || preview.validCount === 0}
        >
          {preview ? `Загрузить ${preview.validCount} строк` : 'Загрузить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
