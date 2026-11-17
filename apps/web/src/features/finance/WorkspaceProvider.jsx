import { seedSettings, settingsView } from '../settings/settingsService.js';
import {
  scopedFinancialData,
  authorizedWorkspaces,
} from '../settings/permissions.js';
import { createFinancialStore } from '../income/incomeService.js';
import { scenarioData } from './data/financialService.js';
import { useRef, useState, useSyncExternalStore, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/hooks/useAuth.js';
import { financialData, DEFAULT_FILTERS } from './data/financialData.js';
import { getFinancialData } from './data/financialService.js';
import {
  initialConversations,
  askAssistant,
} from '../assistant/assistantService.js';
import { WorkspaceContext } from './WorkspaceContext.js';
export default function WorkspaceProvider({ children }) {
  const unsaved = useRef(false);
  const setUnsaved = useCallback((value) => {
    unsaved.current = value;
  }, []);
  const confirmDiscard = () =>
    !unsaved.current ||
    window.confirm(
      `Discard unsaved ${typeof unsaved.current === 'string' ? unsaved.current : 'invoice'} changes?`,
    );
  const authUser = useAuth();
  const [actorId, setActorId] = useState(authUser.id);
  const [store] = useState(() =>
    createFinancialStore(seedSettings(financialData, authUser)),
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const settings = settingsView(snapshot, actorId, filters.workspaceId);
  const user = { ...authUser, ...settings.user, role: settings.role };
  const hasAccess = Boolean(settings.role);
  const [conversations, setConversations] = useState(() =>
    initialConversations(financialData, DEFAULT_FILTERS).map((c) => ({
      ...c,
      workspaceId: 'personal',
      userId: authUser.id,
    })),
  );
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const counter = useRef(0);
  const sending = useRef(false);
  const query = useQuery({
    queryKey: ['financial-demo', user.email, filters.scenario],
    queryFn: ({ signal }) =>
      getFinancialData({ scenario: filters.scenario, signal }),
    retry: false,
    staleTime: Infinity,
  });
  const ledger = {
    ...query,
    data: query.data
      ? scenarioData(
          scopedFinancialData(snapshot, actorId, filters.workspaceId),
          filters.scenario,
        )
      : undefined,
  };
  function setFilter(name, value) {
    if (
      name === 'workspaceId' &&
      (!authorizedWorkspaces(snapshot, actorId).some((w) => w.id === value) ||
        !confirmDiscard())
    )
      return;
    if (name === 'workspaceId') setActiveId(null);
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (['workspaceId', 'currency'].includes(name)) next.accountId = 'all';
      if (name === 'workspaceId') {
        next.participantId = 'all';
        next.currency = 'AUD';
      }
      return next;
    });
  }
  function newChat() {
    setActiveId(null);
  }
  async function send(text, { retryId } = {}) {
    if (
      !hasAccess ||
      !text.trim() ||
      sending.current ||
      !ledger.data ||
      ledger.isPending ||
      ledger.isError
    )
      return false;
    sending.current = true;
    setBusy(true);
    const currentFilters = { ...filters };
    const currentData = ledger.data;
    const conversationId = activeId || `conversation-${++counter.current}`;
    const messageId = retryId || `message-${++counter.current}`;
    if (!activeId) {
      setConversations((current) => [
        ...current,
        {
          id: conversationId,
          workspaceId: filters.workspaceId,
          userId: actorId,
          title: text.trim().slice(0, 50),
          messages: [],
        },
      ]);
      setActiveId(conversationId);
    }
    setConversations((current) =>
      current.map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              messages: retryId
                ? c.messages.map((m) =>
                    m.id === retryId ? { ...m, error: null, loading: true } : m,
                  )
                : [
                    ...c.messages,
                    {
                      id: `${messageId}-user`,
                      role: 'user',
                      text: text.trim(),
                    },
                    {
                      id: messageId,
                      role: 'assistant',
                      question: text.trim(),
                      loading: true,
                    },
                  ],
            },
      ),
    );
    try {
      const response = await askAssistant(text, currentData, currentFilters, {
        retry: Boolean(retryId),
      });
      setConversations((current) =>
        current.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, loading: false, response } : m,
                ),
              },
        ),
      );
    } catch (error) {
      setConversations((current) =>
        current.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, loading: false, error: error.message }
                    : m,
                ),
              },
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
    return true;
  }
  const visibleConversations = conversations.filter(
    (c) =>
      hasAccess &&
      c.workspaceId === filters.workspaceId &&
      c.userId === actorId,
  );
  const value = {
    user,
    settings,
    hasAccess,
    demoIdentities: snapshot.users.map(({ id, fullName }) => ({
      id,
      fullName,
    })),
    switchDemoIdentity(id) {
      if (!snapshot.users.some((u) => u.id === id) || !confirmDiscard()) return;
      setActorId(id);
      setActiveId(null);
      setNotice(null);
      const allowed = authorizedWorkspaces(snapshot, id);
      setFilters({
        ...DEFAULT_FILTERS,
        workspaceId: allowed[0]?.id || 'no-access',
      });
    },
    setUnsaved,
    confirmDiscard,
    filters,
    setFilter,
    ledger,
    canEdit:
      ['owner', 'editor'].includes(settings.role) &&
      filters.scenario === 'normal',
    command: (action, payload) =>
      store.command(
        { ...filters, userId: actorId, role: settings.role },
        action,
        payload,
      ),
    conversations: visibleConversations,
    activeId,
    setActiveId,
    activeConversation: visibleConversations.find((c) => c.id === activeId),
    newChat,
    busy,
    send,
    notice,
    setNotice,
    rename(id, title) {
      if (title.trim())
        setConversations((current) =>
          current.map((c) =>
            c.id === id ? { ...c, title: title.trim().slice(0, 80) } : c,
          ),
        );
    },
    remove(id) {
      setConversations((current) => current.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    dismissSuggestion(id) {
      setConversations((current) =>
        current.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === id ? { ...m, suggestionDismissed: true } : m,
          ),
        })),
      );
    },
    unavailable(action) {
      setNotice({
        title: action,
        body: `${action} is not available in this demo. No external transaction, import or delivery will be performed. The corresponding module will be implemented in a later block.`,
      });
    },
    workspaceName: settings.workspace?.name || 'No workspace access',
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
