// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceContext } from '../WorkspaceContext.js';
import { DEFAULT_FILTERS } from '../data/financialData.js';
import ChatComposer from '../../assistant/ChatComposer.jsx';
afterEach(cleanup);
function setup(overrides = {}) {
  const send = vi.fn().mockResolvedValue(true);
  render(
    <WorkspaceContext.Provider
      value={{
        filters: DEFAULT_FILTERS,
        setFilter: vi.fn(),
        send,
        busy: false,
        ledger: { data: {} },
        ...overrides,
      }}
    >
      <ChatComposer />
    </WorkspaceContext.Provider>,
  );
  return { user: userEvent.setup({ applyAccept: false }), send };
}
describe('financial question composer', () => {
  it('validates blank messages and sends multiline text once with Enter', async () => {
    const { user, send } = setup();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a financial question',
    );
    const text = screen.getByLabelText('Ask about your finances');
    expect(text).toHaveFocus();
    await user.type(text, 'Spending{Shift>}{Enter}{/Shift}this month');
    expect(send).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(send).toHaveBeenCalledExactlyOnceWith('Spending\nthis month');
    expect(text).toHaveValue('');
  });
  it('blocks sending while a response or ledger load is pending', async () => {
    const { user, send } = setup({ busy: true });
    await user.type(
      screen.getByLabelText('Ask about your finances'),
      'Spending{Enter}',
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });
  it('validates attachment extension and size, and removes a valid selection', async () => {
    const { user } = setup();
    const input = screen.getByLabelText('Select statement file');
    await user.upload(
      input,
      new File(['text'], 'wrong.txt', { type: 'text/plain' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a CSV or PDF');
    const large = new File(['a'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(large, 'size', { value: 11 * 1024 * 1024 });
    await user.upload(input, large);
    expect(screen.getByRole('alert')).toHaveTextContent('smaller than 10 MB');
    await user.upload(
      input,
      new File(['amount\n10'], 'statement.csv', { type: 'text/csv' }),
    );
    expect(
      screen.getByText(/Selected only, not uploaded or analyzed/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove attachment' }));
    expect(screen.queryByText(/Selected only/)).toBeNull();
  });
});
