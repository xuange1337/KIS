import { CustomFieldDto } from '@crm/shared';
import {
  FormControlLabel,
  Grid,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';

export type CustomValues = Record<string, string | number | boolean>;

/**
 * Поля формы, заданные организацией. Значения хранятся в строках, чтобы
 * пользователь мог очистить числовое поле; приведение типов делает сервер.
 */
export function CustomFieldsForm({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDto[];
  values: Record<string, string | boolean>;
  onChange: (fieldId: number, value: string | boolean) => void;
}) {
  return (
    <>
      {fields.map((field) => {
        const key = String(field.fieldId);
        const value = values[key];
        if (field.type === 'boolean')
          return (
            <Grid item xs={12} sm={6} key={key}>
              <FormControlLabel
                label={field.name}
                control={
                  <Switch
                    checked={value === true}
                    onChange={(event) =>
                      onChange(field.fieldId, event.target.checked)
                    }
                  />
                }
              />
            </Grid>
          );
        return (
          <Grid item xs={12} sm={6} key={key}>
            <TextField
              fullWidth
              select={field.type === 'select'}
              label={field.name}
              type={
                field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : 'text'
              }
              InputLabelProps={field.type === 'date' ? { shrink: true } : {}}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => onChange(field.fieldId, event.target.value)}
            >
              {field.type === 'select' && [
                <MenuItem key="" value="">
                  Не выбрано
                </MenuItem>,
                ...field.options.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                )),
              ]}
            </TextField>
          </Grid>
        );
      })}
    </>
  );
}

/** Из состояния формы собирает объект для отправки: пустые значения очищают поле. */
export function toPayload(
  fields: CustomFieldDto[],
  values: Record<string, string | boolean>,
): Record<string, string | boolean | null> {
  const payload: Record<string, string | boolean | null> = {};
  for (const field of fields) {
    const value = values[String(field.fieldId)];
    payload[String(field.fieldId)] =
      value === undefined || value === '' ? null : value;
  }
  return payload;
}

/** Исходные значения формы из сохранённых в карточке. */
export function toFormValues(
  fields: CustomFieldDto[],
  saved: CustomValues | undefined,
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    const value = saved?.[String(field.fieldId)];
    if (value === undefined) continue;
    values[String(field.fieldId)] =
      typeof value === 'boolean' ? value : String(value);
  }
  return values;
}
