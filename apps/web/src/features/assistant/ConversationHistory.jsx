import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
export default function ConversationHistory({ onOpen = () => {} }) {
  const {
    conversations,
    activeId,
    setActiveId,
    newChat,
    rename,
    remove,
    busy,
  } = useWorkspace();
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();
  const found = conversations.filter((c) =>
    `${c.title} ${c.messages.map((m) => m.text || m.response?.text || '').join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="conversation-history" aria-label="Conversation history">
      <h2>Your conversations</h2>
      <button
        className="new-chat"
        type="button"
        disabled={busy}
        onClick={() => {
          newChat();
          navigate('/');
          onOpen();
        }}
      >
        ＋ New chat
      </button>
      <label className="history-search">
        <span className="sr-only">Search conversations</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
          type="search"
        />
      </label>
      <p className="history-caption">Recent · This session only</p>
      {!found.length && (
        <p className="history-empty">
          {conversations.length
            ? 'No conversations match your search.'
            : 'No conversations yet. Start a new chat.'}
        </p>
      )}
      <ul>
        {found.map((c) => (
          <li key={c.id} className={activeId === c.id ? 'selected' : ''}>
            <button
              className="conversation-open"
              onClick={() => {
                setActiveId(c.id);
                navigate('/');
                onOpen();
              }}
              aria-current={activeId === c.id ? 'true' : undefined}
            >
              {c.title}
            </button>
            <div className="conversation-tools">
              <button
                aria-label={`Rename ${c.title}`}
                disabled={busy}
                onClick={() => {
                  setEdit(c);
                  setTitle(c.title);
                }}
              >
                Rename
              </button>
              <button
                aria-label={`Delete ${c.title}`}
                disabled={busy}
                onClick={() => setDeleting(c)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AppDialog
        open={Boolean(edit)}
        title="Rename conversation"
        onClose={() => setEdit(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              rename(edit.id, title);
              setEdit(null);
            }
          }}
        >
          <label>
            Conversation title
            <input
              autoComplete="off"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={!title.trim()}>
            Save name
          </button>
        </form>
      </AppDialog>
      <AppDialog
        open={Boolean(deleting)}
        title="Delete conversation?"
        onClose={() => setDeleting(null)}
      >
        <p>
          This removes “{deleting?.title}” from this demo session. It cannot be
          undone.
        </p>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            onClick={() => setDeleting(null)}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={() => {
              remove(deleting.id);
              setDeleting(null);
            }}
          >
            Delete conversation
          </button>
        </div>
      </AppDialog>
    </section>
  );
}
