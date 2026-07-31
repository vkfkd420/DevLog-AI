export interface CreateTodoDto {
  projectId: string;
  title: string;
  /** high | normal | low, 기본 normal */
  priority?: string;
  /** ISO 8601 날짜 문자열 */
  dueDate?: string;
  /** manual | ai_suggested, 기본 manual */
  source?: string;
  sessionId?: string;
  eventId?: string;
  documentId?: string;
}
