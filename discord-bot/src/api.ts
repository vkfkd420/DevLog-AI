import type {
  AutoDraftSetting,
  AutoSyncResult,
  Connector,
  DiscoveredProject,
  DocumentDetail,
  DocumentSummary,
  GenerateReportResult,
  Project,
  QuickRegisterResult,
  TimelineEvent,
  Todo,
  TodoRecommendation,
} from './types';

const API_BASE = process.env.DEVLOG_API_BASE ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export function fetchProjects(includeArchived = false): Promise<Project[]> {
  return request<Project[]>(`/projects${includeArchived ? '?includeArchived=true' : ''}`);
}

export function quickRegisterProject(name: string, rootPath: string): Promise<QuickRegisterResult> {
  return request<QuickRegisterResult>('/projects/quick-register', {
    method: 'POST',
    body: JSON.stringify({ name, rootPath }),
  });
}

export function discoverProjects(root: string): Promise<DiscoveredProject[]> {
  return request<DiscoveredProject[]>(`/projects/discover/scan?root=${encodeURIComponent(root)}`);
}

export function updateProject(id: string, patch: { name?: string; archived?: boolean }): Promise<Project> {
  return request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteProject(id: string): Promise<{ id: string; deleted: boolean }> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export function fetchConnectors(): Promise<Connector[]> {
  return request<Connector[]>('/connectors');
}

export function runAllSync(): Promise<AutoSyncResult> {
  return request<AutoSyncResult>('/sync/run-all', { method: 'POST' });
}

export function fetchAutoDraftSetting(): Promise<AutoDraftSetting> {
  return request<AutoDraftSetting>('/settings/auto-draft');
}

export function updateAutoDraftSetting(
  patch: Partial<Pick<AutoDraftSetting, 'enabled' | 'time' | 'daysOfWeek'>>,
): Promise<AutoDraftSetting> {
  return request<AutoDraftSetting>('/settings/auto-draft', { method: 'PATCH', body: JSON.stringify(patch) });
}

// projectId를 생략하면 웹 대시보드의 "전체" 보기와 동일하게 모든 프로젝트를 합쳐서 가져온다.
export function fetchTodos(projectId?: string): Promise<Todo[]> {
  return request<Todo[]>(`/todos${projectId ? `?projectId=${projectId}` : ''}`);
}

export function fetchTodoRecommendations(projectId?: string): Promise<TodoRecommendation[]> {
  return request<TodoRecommendation[]>(`/todos/recommendations${projectId ? `?projectId=${projectId}` : ''}`);
}

export function createTodo(dto: {
  projectId?: string;
  title: string;
  priority?: string;
  dueDate?: string;
  source?: string;
  sessionId?: string;
  documentId?: string;
}): Promise<Todo> {
  return request<Todo>('/todos', { method: 'POST', body: JSON.stringify(dto) });
}

export function updateTodo(id: string, patch: { completed?: boolean }): Promise<Todo> {
  return request<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function fetchAllWorklogDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>('/documents?type=worklog');
}

export function fetchDocuments(projectId: string): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>(`/documents?projectId=${projectId}&type=worklog`);
}

// projectId를 생략하면(전체 보기) 모든 프로젝트의 이벤트를 가져온다.
export function fetchEvents(projectId?: string): Promise<TimelineEvent[]> {
  return request<TimelineEvent[]>(`/events${projectId ? `?projectId=${projectId}` : ''}`);
}

export function fetchDocument(id: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/documents/${id}`);
}

export function generateReport(projectId: string, periodStart: string, periodEnd: string): Promise<GenerateReportResult> {
  return request<GenerateReportResult>('/documents/report', {
    method: 'POST',
    body: JSON.stringify({ projectId, periodStart, periodEnd }),
  });
}

// 프로젝트 필터 없이 모든 프로젝트의 기간 보고서를 가져온다.
export function fetchAllReports(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>('/documents?type=report');
}
