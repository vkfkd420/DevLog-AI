export interface QueryTodosDto {
  projectId?: string;
  /** 'true' | 'false' — 생략하면 완료/미완료 전부 */
  completed?: string;
}
