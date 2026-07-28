// Event Store에 새 이벤트를 적재(append)할 때의 입력 형태.
// Timeline Engine 설계(6단계)의 공통 Envelope을 그대로 따른다.
export interface CreateEventDto {
  connectorId: string;
  projectId?: string;
  source: string;
  type: string;
  /** ISO 8601 문자열 — 실제 활동이 발생한 시각 */
  occurredAt: string;
  /** source + 외부 고유 ID 조합의 중복 방지 키 */
  dedupKey: string;
  /** filePath, branch, traceId, resource, externalSessionRef 등 표준화된 연결 신호 */
  correlationHints?: Record<string, unknown>;
  payload: Record<string, unknown>;
}
