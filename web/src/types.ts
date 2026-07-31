export interface Project {
  id: string;
  name: string;
  rootPath: string;
  archivedAt: string | null;
}

export interface AutoDraftSetting {
  id: string;
  enabled: boolean;
  // "HH:mm" 24시간제
  time: string;
  // JS Date.getDay() 기준 콤마 구분 (0=일 ~ 6=토)
  daysOfWeek: string;
  lastRunDate: string | null;
  updatedAt: string;
}

export interface QuickRegisterResult {
  project: Project;
  connectorId: string;
  scannedCommits: number;
  truncated: boolean;
  sessionsCreated: number;
  syncError: string | null;
}

export interface TimelineEvent {
  id: string;
  projectId: string | null;
  source: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  correlationHints: Record<string, unknown> | null;
  sessionId: string | null;
}

export interface SessionSummary {
  id: string;
  sessionNumber: number;
  startAt: string;
  endAt: string;
  title: string;
  eventCount: number;
  commitCount: number;
  aiQuestionCount: number;
  errorCount: number;
}

export interface DocumentSummary {
  id: string;
  projectId: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'final';
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string | null;
}

export interface GenerateWorklogResult {
  documentId: string;
  content: string;
  eventCount: number;
  sessionCount: number;
}

export interface GenerateReportResult {
  documentId: string;
  content: string;
  eventCount: number;
  sessionCount: number;
}

export interface Plugin {
  key: string;
  name: string;
  type: string;
  version: string;
  configSchema: Record<string, unknown>;
  permissions: string[];
  description: string;
}

export interface AutoSyncResult {
  ranAt: string;
  syncedConnectors: number;
  failedConnectors: number;
  projectsRecomputed: number;
}

export interface Connector {
  id: string;
  pluginKey: string;
  projectId: string | null;
  config: Record<string, unknown>;
  status: 'enabled' | 'disabled' | 'error';
  lastHealthCheckAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface DocumentVersionInfo {
  id: string;
  documentId: string;
  versionNumber: number;
  content: string;
  generatedBy: 'ai_generated' | 'user_edited';
  sourceModel: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface KnowledgeEntrySummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  cause: string | null;
  solution: string | null;
  commits: { id: string; message: string; occurredAt: string }[];
  aiChats: { id: string; question: string; occurredAt: string }[];
  files: string[];
  worklogs: { id: string; periodStart: string }[];
}

export interface Todo {
  id: string;
  // null이면 프로젝트에 속하지 않는 일반 할 일이다.
  projectId: string | null;
  title: string;
  priority: 'high' | 'normal' | 'low';
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  source: 'manual' | 'ai_suggested';
  createdAt: string;
  sessionId: string | null;
  eventId: string | null;
  documentId: string | null;
}

export interface TodoRecommendation {
  key: string;
  type: 'resume_session' | 'pending_todo' | 'draft_worklog';
  message: string;
  projectId: string;
  sessionId?: string;
  documentId?: string;
}

export interface SearchResult {
  commits: { id: string; message: string; occurredAt: string }[];
  aiChats: { id: string; question: string; occurredAt: string }[];
  files: string[];
  worklogs: { id: string; periodStart: string; snippet: string }[];
  knowledge: { id: string; title: string; snippet: string }[];
}
