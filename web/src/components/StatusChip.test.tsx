import {
  ActivityStatus,
  ClientStatus,
  DealStage,
  OfferStatus,
} from '@crm/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ActivityStatusChip,
  ClientStatusChip,
  DealStageChip,
  OfferStatusChip,
} from './StatusChip';

describe('Маркировка стадий и статусов', () => {
  it('выводит русские названия стадий сделки', () => {
    render(<DealStageChip stage={DealStage.NEGOTIATION} />);
    expect(screen.getByText('Переговоры')).toBeInTheDocument();
  });

  it('различает выигранную и проигранную сделку', () => {
    const { rerender } = render(<DealStageChip stage={DealStage.WON} />);
    expect(screen.getByText('Сделка выиграна')).toBeInTheDocument();

    rerender(<DealStageChip stage={DealStage.LOST} />);
    expect(screen.getByText('Сделка проиграна')).toBeInTheDocument();
  });

  it('выводит названия статусов клиента, активности и предложения', () => {
    render(
      <>
        <ClientStatusChip status={ClientStatus.IN_WORK} />
        <ActivityStatusChip status={ActivityStatus.PLANNED} />
        <OfferStatusChip status={OfferStatus.ACCEPTED} />
      </>,
    );
    expect(screen.getByText('В работе')).toBeInTheDocument();
    expect(screen.getByText('Запланирована')).toBeInTheDocument();
    expect(screen.getByText('Принято')).toBeInTheDocument();
  });

  it('покрывает подписями все стадии сделки', () => {
    // Стадия без подписи проявилась бы пустой меткой в списках и канбане
    Object.values(DealStage).forEach((stage) => {
      const { container, unmount } = render(<DealStageChip stage={stage} />);
      const label = container.textContent?.trim() ?? '';
      expect(label.length).toBeGreaterThan(0);
      // Показывается русская подпись, а не техническое значение стадии
      expect(label).not.toBe(stage);
      unmount();
    });
  });

  it('обозначает стадию цветной точкой рядом с подписью', () => {
    // Точка заменяет цветную плашку: в плотной таблице заливки спорят
    // друг с другом, а маркер читается так же однозначно
    const { container } = render(<DealStageChip stage={DealStage.WON} />);
    const marker = container.querySelector('div[class*="MuiBox"]');
    expect(marker).not.toBeNull();
    expect(container.textContent).toContain('Сделка выиграна');
  });
});
