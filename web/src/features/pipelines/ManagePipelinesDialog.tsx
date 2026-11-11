import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DEAL_STAGE_LABELS, DealStage } from '@crm/shared';
import { FormEvent, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import {
  useDeletePipeline,
  usePipelines,
  useSavePipeline,
} from '../../api/hooks';

const WORK_STAGES: DealStage[] = [
  DealStage.NEW,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];

/** Воронки: набор рабочих стадий под разные процессы продаж. */
export function ManagePipelinesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = usePipelines();
  const save = useSavePipeline();
  const remove = useDeletePipeline();
  const [name, setName] = useState('');
  const [stages, setStages] = useState<DealStage[]>([
    DealStage.NEW,
    DealStage.PROPOSAL,
  ]);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(extractErrorMessage(caught, fallback));
    }
  };

  const toggle = (stage: DealStage) =>
    setStages((previous) =>
      previous.includes(stage)
        ? previous.filter((item) => item !== stage)
        : WORK_STAGES.filter(
            (item) => item === stage || previous.includes(item),
          ),
    );

  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await save.mutateAsync({ name: name.trim(), stages });
      setName('');
    }, 'Не удалось создать воронку');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Воронки продаж</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <form onSubmit={create}>
            <Stack spacing={1}>
              <TextField
                label="Название новой воронки"
                size="small"
                value={name}
                onChange={(event) => setName(event.target.value)}
                inputProps={{ maxLength: 80 }}
              />
              <Stack direction="row" flexWrap="wrap">
                {WORK_STAGES.map((stage) => (
                  <FormControlLabel
                    key={stage}
                    label={DEAL_STAGE_LABELS[stage]}
                    control={
                      <Checkbox
                        checked={stages.includes(stage)}
                        onChange={() => toggle(stage)}
                      />
                    }
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                «Выиграна» и «Проиграна» добавляются в каждую воронку сами
              </Typography>
              <div>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    !name.trim() || stages.length === 0 || save.isPending
                  }
                >
                  Создать воронку
                </Button>
              </div>
            </Stack>
          </form>
          {data?.map((pipeline) => (
            <Stack
              key={pipeline.pipelineId}
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <div style={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {pipeline.name}
                  {pipeline.isDefault ? ' · основная' : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pipeline.stages
                    .map((stage) => DEAL_STAGE_LABELS[stage])
                    .join(' → ')}{' '}
                  · сделок: {pipeline.dealsCount}
                </Typography>
              </div>
              {!pipeline.isDefault && (
                <>
                  <Button
                    size="small"
                    disabled={save.isPending}
                    onClick={() =>
                      void run(
                        () =>
                          save.mutateAsync({
                            pipelineId: pipeline.pipelineId,
                            isDefault: true,
                          }),
                        'Не удалось сменить основную воронку',
                      )
                    }
                  >
                    Сделать основной
                  </Button>
                  <IconButton
                    aria-label={`Удалить воронку ${pipeline.name}`}
                    disabled={remove.isPending}
                    onClick={() =>
                      void run(
                        () => remove.mutateAsync(pipeline.pipelineId),
                        'Не удалось удалить воронку',
                      )
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </>
              )}
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
