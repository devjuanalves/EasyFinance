import { useRef, useState } from 'react';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppIcon from '../../components/ui/AppIcon.jsx';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
export default function ChatComposer() {
  const { send, busy, ledger } = useWorkspace();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const disabled = busy || ledger.isPending || ledger.isError;
  async function submit(event) {
    event?.preventDefault();
    if (disabled) return;
    if (!text.trim()) {
      setError('Enter a financial question before sending.');
      textRef.current?.focus();
      return;
    }
    if (text.length > 2000) {
      setError('Use 2,000 characters or fewer.');
      return;
    }
    setError('');
    const question = text;
    setText('');
    await send(question);
    textRef.current?.focus();
  }
  function selectFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!/\.(csv|pdf)$/i.test(selected.name)) {
      setError('Choose a CSV or PDF file.');
      setFile(null);
      event.target.value = '';
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Choose a file smaller than 10 MB.');
      setFile(null);
      event.target.value = '';
      return;
    }
    setFile({ name: selected.name });
    setError('');
    event.target.value = '';
  }
  return (
    <section className="composer-panel" aria-label="Conversation composer">
      <FinancialFilters compact />
      {file && (
        <div className="attachment-selection">
          <span>{file.name} · Selected only, not uploaded or analyzed</span>
          <button type="button" onClick={() => setFile(null)}>
            Remove attachment
          </button>
        </div>
      )}
      <form onSubmit={submit}>
        <div className="composer-input">
          <button
            type="button"
            className="icon-button"
            aria-label="Attach CSV or PDF"
            onClick={() => fileRef.current.click()}
          >
            <AppIcon name="attach" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.pdf"
            aria-label="Select statement file"
            className="sr-only"
            onChange={selectFile}
          />
          <label className="sr-only" htmlFor="financial-question">
            Ask about your finances
          </label>
          <textarea
            id="financial-question"
            ref={textRef}
            rows={2}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask anything about your finances…"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'composer-error' : 'composer-help'}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            className="icon-button send-button"
            type="submit"
            disabled={disabled}
            aria-label="Send message"
          >
            <AppIcon name="send" />
          </button>
        </div>
        {error && (
          <p id="composer-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <p id="composer-help" className="composer-help">
          {busy
            ? 'Calculating sample response…'
            : 'Enter to send · Shift + Enter for a new line'}
          <span>No real AI · File processing unavailable</span>
        </p>
      </form>
    </section>
  );
}
