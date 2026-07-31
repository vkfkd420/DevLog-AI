export interface UpdateTodoDto {
  title?: string;
  priority?: string;
  /** ISO 8601 날짜 문자열, null이면 마감일 제거 */
  dueDate?: string | null;
  completed?: boolean;
}
