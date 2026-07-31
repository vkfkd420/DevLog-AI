export interface CreateTodoDto {
  /** 생략하면 프로젝트에 속하지 않는 일반 할 일로 등록된다. */
  projectId?: string;
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
