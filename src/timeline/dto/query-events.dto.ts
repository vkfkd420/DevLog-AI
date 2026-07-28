// Timeline 조회 필터 — 4단계 DB 설계에서 확정한 핵심 접근 패턴(projectId + 기간)을 반영.
export interface QueryEventsDto {
  projectId?: string;
  source?: string;
  type?: string;
  /** ISO 8601 문자열 */
  from?: string;
  /** ISO 8601 문자열 */
  to?: string;
}
