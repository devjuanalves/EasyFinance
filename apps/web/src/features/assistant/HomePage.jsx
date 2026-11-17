import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { suggestedQuestions } from './assistantService.js';
import AssistantResponse from './AssistantResponse.jsx';
import ChatComposer from './ChatComposer.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';
export default function HomePage() {
  const navigate = useNavigate();
  const {
    user,
    activeConversation,
    ledger,
    unavailable,
    send,
    busy,
    workspaceName,
    setFilter,
  } = useWorkspace();
  const messagesEnd = useRef(null);
  const count = activeConversation?.messages.length || 0;
  useEffect(() => {
    if (count > 2)
      messagesEnd.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'instant',
      });
  }, [count, busy]);
  return (
    <main className="workspace-content home-page">
      <section className="conversation-heading">
        <div>
          <h1>
            {activeConversation
              ? activeConversation.title
              : `Welcome, ${user.fullName.split(' ')[0]}.`}
          </h1>
          <span className="app-badge">
            {workspaceName} · Sample financial assistant
          </span>
          <p>
            Based on a fictional ledger · Conversations stay in this session
          </p>
        </div>
        <button
          className="compact-button"
          onClick={() => unavailable('Share conversation')}
        >
          Share report
        </button>
      </section>
      {ledger.isPending && (
        <p role="status" className="partial-banner">
          Loading financial sample…
        </p>
      )}
      {ledger.isError && (
        <div className="form-error" role="alert">
          Unable to load the sample ledger.{' '}
          <button onClick={() => setFilter('scenario', 'normal')}>
            Retry ledger
          </button>
        </div>
      )}
      {!activeConversation ? (
        <section className="welcome-assistant">
          <span className="assistant-mark">
            <AppIcon name="spark" />
          </span>
          <h2>How can I help you manage your finances today?</h2>
          <p>
            Ask a question to explore the same sample data shown on your
            Dashboard.
          </p>
          <div className="suggested-prompts">
            {suggestedQuestions.map((question) => (
              <button
                disabled={busy || !ledger.data || ledger.isError}
                key={question}
                onClick={() => send(question)}
              >
                {question}
                <span>↗</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section
          className="chat-messages"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {activeConversation.messages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <div className="message-author">
                {message.role === 'user' ? (
                  user.fullName
                ) : (
                  <>
                    <span className="assistant-mark">
                      <AppIcon name="spark" />
                    </span>
                    EasyFinance Assistant{' '}
                    <span className="app-badge">DEMO CALCULATION</span>
                  </>
                )}
              </div>
              {message.role === 'user' ? (
                <p className="user-bubble">{message.text}</p>
              ) : (
                <AssistantResponse message={message} />
              )}
            </div>
          ))}
          <div ref={messagesEnd} />
        </section>
      )}
      <section className="quick-actions" aria-label="Quick financial actions">
        {[
          'Import Statement',
          'Create Invoice',
          'Add Investment',
          'Add Transaction',
        ].map((action) => (
          <button
            className="compact-button"
            key={action}
            onClick={() =>
              action === 'Create Invoice'
                ? navigate('/income/invoices/new')
                : action === 'Import Statement'
                  ? navigate('/expenses/import')
                  : action === 'Add Investment'
                    ? navigate('/investments/new')
                    : navigate('/expenses/transactions?add=1')
            }
          >
            {action} ↗
          </button>
        ))}
      </section>
      <ChatComposer />
    </main>
  );
}
