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

// 기존 문서는 마크다운 문자열이 content에 그대로 들어있어 JSON.parse가 실패한다 —
// 그 경우 null을 반환해 호출부에서 <pre>로 예전처럼 보여주고, 새로 생성된 구조화 JSON만 카드로 렌더링한다.
export function parseWorklog(content: string | null): WorklogPayload | null {
  if (!content) {
    return null;
  }
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.commits !== 'number') {
      return null;
    }
    return {
      commits: parsed.commits ?? 0,
      files: parsed.files ?? 0,
      aiQuestions: parsed.aiQuestions ?? 0,
      errors: parsed.errors ?? 0,
      summary: parsed.summary ?? '',
      troubleshooting: parsed.troubleshooting ?? '',
      tomorrow: parsed.tomorrow ?? '',
      note: parsed.note ?? '',
    };
  } catch {
    return null;
  }
}

export function WorklogCard({ payload }: { payload: WorklogPayload }) {
  return (
    <div className="worklog-card">
      <div className="knowledge-section">
        <div className="knowledge-section-label">오늘 작업</div>
        <ul className="knowledge-related-list">
          <li>✅ Git {payload.commits} Commit</li>
          <li>✅ IDE {payload.files} Files</li>
          <li>✅ AI {payload.aiQuestions} Questions</li>
          <li>{payload.errors > 0 ? `✅ Error ${payload.errors}건 발생` : '✅ Error 없음'}</li>
        </ul>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">오늘 한 일 요약</div>
        <p>{payload.summary || '요약할 활동 기록이 없습니다.'}</p>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">트러블슈팅</div>
        <p>{payload.troubleshooting || '특별한 이슈가 없었습니다.'}</p>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">내일 해야할 일</div>
        <p>{payload.tomorrow || '제안된 작업이 없습니다.'}</p>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">메모</div>
        <p>{payload.note || '메모가 없습니다.'}</p>
      </div>
    </div>
  );
}
