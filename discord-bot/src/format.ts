import type { Todo, WorklogPayload } from './types';

export const PRIORITY_LABEL: Record<Todo['priority'], string> = { high: '🔴 높음', normal: '🟡 보통', low: '⚪ 낮음' };

// 기존 문서는 마크다운 문자열이 그대로 들어있어 JSON.parse가 실패한다 — 그 경우 null을 반환한다.
// (web/src/components/WorklogCard.tsx의 parseWorklog와 동일한 로직)
export function parseWorklog(content: string | null): WorklogPayload | null {
  if (!content) return null;
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

export function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return dueDate.slice(5, 10).replace('-', '/');
}

export function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const PRIORITY_ORDER: Record<Todo['priority'], number> = { high: 0, normal: 1, low: 2 };

// web/src/components/TodayTodoCard.tsx의 sortActive와 동일한 정렬 기준(우선순위 → 마감일 → 등록순).
export function sortActiveTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.priority !== b.priority) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    const aDue = a.dueDate ?? '';
    const bDue = b.dueDate ?? '';
    if (aDue !== bDue) {
      if (!aDue) return 1;
      if (!bDue) return -1;
      return aDue.localeCompare(bDue);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
