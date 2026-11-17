import { useSyncExternalStore } from 'react';
import { authService } from '../services/authService.js';
export function useAuth() {
  return useSyncExternalStore(
    authService.subscribe,
    authService.getCurrentUser,
    authService.getCurrentUser,
  );
}
