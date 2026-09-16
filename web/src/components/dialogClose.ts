import { DialogProps } from '@mui/material';

/**
 * Закрытие формы щелчком мимо окна.
 *
 * Форма на десяток полей терялась от одного промаха мышью, а подтверждение
 * на каждое закрытие мешало бы работать. Компромисс: промах игнорируется,
 * Esc и «Отмена» работают как раньше — намеренный выход остаётся в один шаг.
 */
export const closeUnlessBackdrop =
  (onClose: () => void): DialogProps['onClose'] =>
  (_event, reason) => {
    if (reason === 'backdropClick') return;
    onClose();
  };
