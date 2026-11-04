import { API_HEALTH_PATH } from '@easyfinance/shared';
const baseUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '');
export async function getHealth({ signal } = {}) {
  const response = await fetch(`${baseUrl}${API_HEALTH_PATH}`, { signal });
  if (!response.ok) throw new Error('API health request failed');
  return response.json();
}
