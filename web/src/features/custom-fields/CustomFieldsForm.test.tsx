import '@testing-library/jest-dom/vitest';
import { CustomFieldDto } from '@crm/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomFieldsForm, toFormValues, toPayload } from './CustomFieldsForm';

const fields: CustomFieldDto[] = [
  {
    fieldId: 1,
    entity: 'client',
    name: 'Сайт',
    type: 'text',
    options: [],
    position: 1,
  },
  {
    fieldId: 2,
    entity: 'client',
    name: 'Сотрудников',
    type: 'number',
    options: [],
    position: 2,
  },
  {
    fieldId: 3,
    entity: 'client',
    name: 'VIP',
    type: 'boolean',
    options: [],
    position: 3,
  },
];

describe('Пользовательские поля в форме', () => {
  it('собирает значения из сохранённых данных карточки', () => {
    expect(toFormValues(fields, { '1': 'a.ru', '2': 50, '3': true })).toEqual({
      '1': 'a.ru',
      '2': '50',
      '3': true,
    });
  });

  it('пустые значения уходят как null, чтобы очистить поле на сервере', () => {
    expect(toPayload(fields, { '1': '', '3': false })).toEqual({
      '1': null,
      '2': null,
      '3': false,
    });
  });

  it('сообщает об изменении поля с его идентификатором', () => {
    const onChange = vi.fn();
    render(
      <CustomFieldsForm fields={fields} values={{}} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('Сайт'), {
      target: { value: 'example.com' },
    });
    expect(onChange).toHaveBeenCalledWith(1, 'example.com');
  });
});
