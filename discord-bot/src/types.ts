export interface Project {
  id: string;
  name: string;
  rootPath: string;
  archivedAt: string | null;
}

export interface Todo {
  id: string;
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

export interface WorklogPayload {
  commits: number;
  files: number;
  aiQuestions: number;
  errors: number;
  summary: string;
  troubleshooting: string;
  tomorrow: string;
  note: string;
}

export interface GenerateReportResult {
  documentId: string;
  content: string;
  eventCount: number;
  sessionCount: number;
}

export interface QuickRegisterResult {
  project: Project;
  connectorId: string;
  scannedCommits: number;
  truncated: boolean;
  sessionsCreated: number;
  syncError: string | null;
}

export interface DiscoveredProject {
  path: string;
  name: string;
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

export interface AutoSyncResult {
  ranAt: string;
  syncedConnectors: number;
  failedConnectors: number;
  projectsRecomputed: number;
}

export interface AutoDraftSetting {
  id: string;
  enabled: boolean;
  time: string;
  daysOfWeek: string;
  lastRunDate: string | null;
  updatedAt: string;
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
