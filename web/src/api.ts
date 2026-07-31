import type {
  AutoDraftSetting,
  AutoSyncResult,
  Connector,
  DocumentDetail,
  DocumentSummary,
  DocumentVersionInfo,
  GenerateReportResult,
  GenerateWorklogResult,
  KnowledgeEntryDetail,
  KnowledgeEntrySummary,
  Plugin,
  Project,
  QuickRegisterResult,
  SearchResult,
  SessionSummary,
  TimelineEvent,
  Todo,
  TodoRecommendation,
} from './types';

const API_BASE = 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json();
}

export function fetchProjects(includeArchived = false): Promise<Project[]> {
  return request<Project[]>(`/projects${includeArchived ? '?includeArchived=true' : ''}`);
}

// 프로젝트 등록 + git-collector 커넥터 등록 + 초기 동기화 + 세션 재계산을 한 번에 처리.
export function quickRegisterProject(name: string, rootPath: string): Promise<QuickRegisterResult> {
  return request<QuickRegisterResult>('/projects/quick-register', {
    method: 'POST',
    body: JSON.stringify({ name, rootPath }),
  });
}

export function updateProject(id: string, patch: { name?: string; archived?: boolean }): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteProject(id: string): Promise<{ id: string; deleted: boolean }> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

// projectId를 생략하면(전체 보기) 모든 프로젝트의 이벤트를 가져온다.
export function fetchEvents(projectId?: string): Promise<TimelineEvent[]> {
  return request<TimelineEvent[]>(`/events${projectId ? `?projectId=${projectId}` : ''}`);
}

export function fetchDocuments(projectId: string): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>(`/documents?projectId=${projectId}&type=worklog`);
}

// 프로젝트 필터 없이 모든 프로젝트의 업무일지를 가져온다 — 달력에서 날짜별로 어떤 프로젝트를
// 작업했는지 프로젝트 색상별 점으로 표시하기 위함 (projectId 쿼리 생략 시 전체 조회).
export function fetchAllWorklogDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>(`/documents?type=worklog`);
}

export function fetchDocument(id: string): Promise<DocumentDetail> {
  return request<DocumentDetail>(`/documents/${id}`);
}

export function editDocument(
  id: string,
  content: string,
  changeNote?: string,
): Promise<{ id: string; versionNumber: number }> {
  return request(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content, changeNote }),
  });
}

export function finalizeDocument(id: string): Promise<{ id: string; status: string }> {
  return request(`/documents/${id}/finalize`, { method: 'POST' });
}

export function deleteDocument(id: string): Promise<{ id: string; deleted: boolean }> {
  return request(`/documents/${id}`, { method: 'DELETE' });
}

export function fetchDocumentVersions(id: string): Promise<DocumentVersionInfo[]> {
  return request<DocumentVersionInfo[]>(`/documents/${id}/versions`);
}

export function generateWorklog(projectId: string, date: string): Promise<GenerateWorklogResult> {
  return request<GenerateWorklogResult>('/documents/worklog', {
    method: 'POST',
    body: JSON.stringify({ projectId, date }),
  });
}

export function generateReport(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GenerateReportResult> {
  return request<GenerateReportResult>('/documents/report', {
    method: 'POST',
    body: JSON.stringify({ projectId, periodStart, periodEnd }),
  });
}

// 프로젝트 필터 없이 모든 프로젝트의 기간 보고서를 가져온다 (보고서 탭의 "등록된 보고서" 목록용).
export function fetchAllReports(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>('/documents?type=report');
}

export function fetchPlugins(): Promise<Plugin[]> {
  return request<Plugin[]>('/plugins');
}

export function fetchConnectors(): Promise<Connector[]> {
  return request<Connector[]>('/connectors');
}

export function registerConnector(
  pluginKey: string,
  projectId: string | undefined,
  config: Record<string, unknown>,
): Promise<Connector> {
  return request<Connector>('/connectors', {
    method: 'POST',
    body: JSON.stringify({ pluginKey, projectId, config }),
  });
}

export function updateConnector(
  id: string,
  patch: { status?: string; config?: Record<string, unknown> },
): Promise<Connector> {
  return request<Connector>(`/connectors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function syncGitConnector(id: string): Promise<{ connectorId: string; scannedCommits: number; truncated: boolean }> {
  return request(`/git-collector/${id}/sync`, { method: 'POST' });
}

// 5분 주기 자동 동기화를 기다리지 않고 지금 바로 전체 git-collector를 동기화 + 세션 재계산.
export function runAllSync(): Promise<AutoSyncResult> {
  return request<AutoSyncResult>('/sync/run-all', { method: 'POST' });
}

export function fetchSessions(projectId: string): Promise<SessionSummary[]> {
  return request<SessionSummary[]>(`/correlation/${projectId}/sessions`);
}

export function computeCorrelation(
  projectId: string,
): Promise<{ eventsProcessed: number; sessionsCreated: number; sessionsExtended: number; linksCreated: number }> {
  return request(`/correlation/${projectId}/compute`, { method: 'POST' });
}

export function fetchKnowledgeEntries(projectId: string): Promise<KnowledgeEntrySummary[]> {
  return request<KnowledgeEntrySummary[]>(`/knowledge?projectId=${projectId}`);
}

export function fetchKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail> {
  return request<KnowledgeEntryDetail>(`/knowledge/${id}`);
}

export function generateKnowledgeFromEvent(eventId: string): Promise<KnowledgeEntryDetail> {
  return request<KnowledgeEntryDetail>('/knowledge/generate', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  });
}

export function search(projectId: string, q: string): Promise<SearchResult> {
  return request<SearchResult>(`/search?projectId=${projectId}&q=${encodeURIComponent(q)}`);
}

export function fetchAutoDraftSetting(): Promise<AutoDraftSetting> {
  return request<AutoDraftSetting>('/settings/auto-draft');
}

export function updateAutoDraftSetting(
  patch: Partial<Pick<AutoDraftSetting, 'enabled' | 'time' | 'daysOfWeek'>>,
): Promise<AutoDraftSetting> {
  return request<AutoDraftSetting>('/settings/auto-draft', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// projectId를 생략하면(전체 보기) 모든 프로젝트의 TODO를 가져온다.
export function fetchTodos(projectId?: string): Promise<Todo[]> {
  return request<Todo[]>(`/todos${projectId ? `?projectId=${projectId}` : ''}`);
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

export function updateTodo(
  id: string,
  patch: { title?: string; priority?: string; dueDate?: string | null; completed?: boolean },
): Promise<Todo> {
  return request<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteTodo(id: string): Promise<{ id: string; deleted: boolean }> {
  return request(`/todos/${id}`, { method: 'DELETE' });
}

// projectId를 생략하면(전체 보기) 모든 프로젝트를 대상으로 추천을 계산해서 합쳐 받는다.
export function fetchTodoRecommendations(projectId?: string): Promise<TodoRecommendation[]> {
  return request<TodoRecommendation[]>(`/todos/recommendations${projectId ? `?projectId=${projectId}` : ''}`);
}
