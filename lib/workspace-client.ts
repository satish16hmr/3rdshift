// Client-side workspace context management
// Stores the active workspace ID in localStorage and injects it into all API calls

const STORAGE_KEY = '3rdshift_active_workspace';
export const WORKSPACE_CHANGED_EVENT = '3rdshift-workspace-changed';

export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  const previousWorkspaceId = localStorage.getItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, workspaceId);
  if (previousWorkspaceId !== workspaceId) {
    window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: { workspaceId } }));
  }
}

export function clearStoredWorkspaceId(): void {
  if (typeof window === 'undefined') return;
  const previousWorkspaceId = localStorage.getItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  if (previousWorkspaceId) {
    window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: { workspaceId: null } }));
  }
}

/**
 * Wraps a fetch call with the active workspace header.
 * Use this for all /api/ calls so the server knows which workspace to scope data to.
 */
export function workspaceFetch(
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<Response> {
  const workspaceId = getStoredWorkspaceId();
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }
  return fetch(url, { ...options, headers });
}
