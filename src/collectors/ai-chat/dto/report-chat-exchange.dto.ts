export interface ReportChatExchangeDto {
  /** 어떤 도구에서 온 대화인지 (예: 'claude', 'cursor') — 선택 */
  tool?: string;
  question: string;
  answer: string;
  /** ISO 8601 문자열 — 사용자가 질문을 입력한 시각 */
  occurredAt: string;
  /** 도구 자체의 대화/세션 식별자 */
  externalSessionRef?: string;
  /** 대화 중 언급된 파일 (호출자가 알고 있다면 filePath 힌트로 우선 사용) */
  referencedFiles?: string[];
}
