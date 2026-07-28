export type IdeActivityType = 'edit' | 'run' | 'debug_session';

export interface ReportIdeActivityDto {
  filePath: string;
  activityType: IdeActivityType;
  /** ISO 8601 문자열 — 이 활동 보고가 발생한 시각 */
  occurredAt: string;
  /** run/debug_session처럼 이미 끝난 활동을 보고할 때의 소요 시간(ms) */
  durationMs?: number;
  /** run의 종료 코드 */
  exitCode?: number;
  branch?: string;
}
