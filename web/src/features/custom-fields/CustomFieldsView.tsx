import { CustomFieldDto } from '@crm/shared';
import { Grid, Typography } from '@mui/material';
import { formatDate } from '../../components/formatters';

/** Значения пользовательских полей в карточке; пустые поля не показываются. */
export function CustomFieldsView({
  fields,
  values,
}: {
  fields: CustomFieldDto[];
  values: Record<string, string | number | boolean> | undefined;
}) {
  const filled = fields.filter(
    (field) => values?.[String(field.fieldId)] !== undefined,
  );
  if (filled.length === 0) return null;
  return (
    <>
      {filled.map((field) => {
        const value = values?.[String(field.fieldId)];
        const text =
          typeof value === 'boolean'
            ? value
              ? 'Да'
              : 'Нет'
            : field.type === 'date'
              ? formatDate(String(value))
              : String(value);
        return (
          <Grid item xs={12} sm={4} key={field.fieldId}>
            <Typography variant="caption" color="text.secondary">
              {field.name}
            </Typography>
            <Typography variant="body2">{text}</Typography>
          </Grid>
        );
      })}
    </>
  );
}
