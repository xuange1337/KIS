import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUnsavedChanges } from './useUnsavedChanges';

describe('Защита несохранённых изменений', () => {
  it('закрывает сразу, когда правок нет', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(false, onClose));

    act(() => result.current.requestClose());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });

  it('спрашивает подтверждение, когда правки есть', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, onClose));

    act(() => result.current.requestClose());

    // Форма не закрывается, пока пользователь не подтвердил потерю
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(true);
  });

  it('закрывает после подтверждения', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, onClose));

    act(() => result.current.requestClose());
    act(() => result.current.discard());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.confirmOpen).toBe(false);
  });

  it('оставляет форму открытой при отказе', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(true, onClose));

    act(() => result.current.requestClose());
    act(() => result.current.keepEditing());

    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
  });

  it('предупреждает при закрытии вкладки только с правками', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUnsavedChanges(false, vi.fn()));
    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.anything());
    unmount();

    const dirty = renderHook(() => useUnsavedChanges(true, vi.fn()));
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    dirty.unmount();
    // Обработчик снимается: иначе предупреждение осталось бы висеть
    // на всех последующих переходах
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    add.mockRestore();
    remove.mockRestore();
  });
});
