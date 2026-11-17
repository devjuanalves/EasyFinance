// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from '@testing-library/react';
import AppDialog from '../../../components/ui/AppDialog.jsx';
const originalMethods = Object.fromEntries(
  ['showModal', 'close'].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
  ]),
);
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    },
  });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of Object.entries(originalMethods)) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete HTMLDialogElement.prototype[name];
  }
});
function Harness({ onClose }) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  return (
    <>
      <input
        aria-label="Search after dialog"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <AppDialog
        open={open}
        title="Transaction details"
        onClose={() => {
          onClose();
          setOpen(false);
          setSearch('');
        }}
      >
        Source information
      </AppDialog>
    </>
  );
}
it('notifies the owner once when a controlled close produces a native close event', () => {
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search after dialog'), {
    target: { value: 'Annual software' },
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Search after dialog')).toHaveValue(
    'Annual software',
  );
});
it('Escape cancellation notifies once and does not bubble into a parent close handler', () => {
  const onClose = vi.fn(),
    parent = vi.fn();
  render(
    <div onClose={parent}>
      <Harness onClose={onClose} />
    </div>,
  );
  fireEvent(
    screen.getByRole('dialog'),
    new Event('cancel', { cancelable: true }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
});

it('notifies once for a native close and stops propagation', () => {
  const onClose = vi.fn(),
    parent = vi.fn();
  render(
    <div onClose={parent}>
      <Harness onClose={onClose} />
    </div>,
  );
  act(() => screen.getByRole('dialog').close());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
});
it('does not repeat a close request while the owner has not committed closed state', () => {
  const onClose = vi.fn();
  render(
    <AppDialog open title="Pending close" onClose={onClose}>
      Content
    </AppDialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  act(() => screen.getByRole('dialog').close());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('allows a new close notification after reopening', () => {
  const onClose = vi.fn();
  const view = render(
    <AppDialog open title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  view.rerender(
    <AppDialog open={false} title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  view.rerender(
    <AppDialog open title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(onClose).toHaveBeenCalledTimes(2);
});
it('ignores an old queued native close event after the dialog has reopened', () => {
  const onClose = vi.fn();
  const view = render(
    <AppDialog open title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  view.rerender(
    <AppDialog open={false} title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  view.rerender(
    <AppDialog open title="Reopen" onClose={onClose}>
      Content
    </AppDialog>,
  );
  fireEvent(screen.getByRole('dialog'), new Event('close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog')).toBeVisible();
});
