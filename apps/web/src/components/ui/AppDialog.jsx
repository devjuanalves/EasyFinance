import { useEffect, useId, useRef } from 'react';
export default function AppDialog({
  open,
  title,
  onClose,
  children,
  closeDisabled = false,
}) {
  const ref = useRef(null);
  const id = useId();
  const closeRequested = useRef(false);
  function requestClose() {
    if (!open || closeRequested.current || closeDisabled) return;
    closeRequested.current = true;
    onClose();
  }
  useEffect(() => {
    if (open && !ref.current.open) {
      closeRequested.current = false;
      ref.current.showModal();
    } else if (!open && ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="info-dialog app-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        requestClose();
      }}
      onClose={(event) => {
        event.stopPropagation();
        // Closing a controlled dialog already notified its owner. The native
        // close event must not trigger a second navigation or state reset.
        // Ignore an older queued event if the dialog has already reopened.
        if (!event.currentTarget.open) requestClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={closeDisabled}
          onClick={requestClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
