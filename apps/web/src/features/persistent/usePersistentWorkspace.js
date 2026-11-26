import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/hooks/useAuth.js';
import { api } from '../../services/persistentApi.js';
export function usePersistentWorkspace() {
  const user = useAuth(),
    [params] = useSearchParams();
  const [workspaceId, setWorkspace] = useState(params.get('workspace') || '');
  const workspaces = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const selected = workspaceId
    ? workspaces.data?.find((w) => w.id === workspaceId)
    : workspaces.data?.[0];
  return {
    user,
    workspaces,
    selected,
    wid: selected?.id,
    setWorkspace,
    prefix: ['persistent', user.id, selected?.id],
  };
}
