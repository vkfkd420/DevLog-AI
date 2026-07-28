import { useEffect, useState } from 'react';
import { fetchEvents } from '../api';
import type { TimelineEvent } from '../types';

interface Insight {
  key: string;
  label: string;
  value: string;
  detail: string;
}

const STOPWORDS = new Set([
  '이거',
  '저거',
  '그거',
  '이것',
  '저것',
  '그것',
  '어떻게',
  '왜',
  '무엇',
  '어디서',
  '언제',
  '있나요',
  '있습니까',
  '해야',
  '하는',
  '합니다',
  'the',
  'a',
  'an',
  'is',
  'are',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'how',
  'what',
  'why',
  'this',
  'that',
]);

function filePath(event: TimelineEvent): string | null {
  return (
    (event.correlationHints?.filePath as string | undefined) ??
    ((event.payload as { filePath?: string } | undefined)?.filePath) ??
    null
  );
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function isErrorEvent(event: TimelineEvent): boolean {
  return event.type === 'error' || event.source === 'log';
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes}분` : `${hours}시간 ${minutes}분`;
}

function topEntry<T>(counts: Map<T, number>): [T, number] | null {
  let best: [T, number] | null = null;
  for (const entry of counts.entries()) {
    if (!best || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best;
}

function buildInsights(events: TimelineEvent[]): Insight[] {
  const editCounts = new Map<string, number>();
  const workMsByFile = new Map<string, number>();
  const errorCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();

  for (const event of events) {
    const fp = filePath(event);
    if (fp) {
      editCounts.set(fp, (editCounts.get(fp) ?? 0) + 1);
    }

    const durationMs = (event.payload as { durationMs?: number } | undefined)?.durationMs;
    if (event.source === 'ide' && fp && typeof durationMs === 'number') {
      workMsByFile.set(fp, (workMsByFile.get(fp) ?? 0) + durationMs);
    }

    if (isErrorEvent(event)) {
      const payload = event.payload as { errorType?: string; message?: string } | undefined;
      const errorKey = payload?.errorType ?? payload?.message ?? '알 수 없는 에러';
      errorCounts.set(errorKey, (errorCounts.get(errorKey) ?? 0) + 1);
    }

    if (event.source === 'ai-chat' && event.type === 'chat_exchange') {
      const question = (event.payload as { question?: string } | undefined)?.question ?? '';
      const words = question
        .split(/[\s,.?!"'()[\]{}:;/\\~`]+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    const hour = new Date(event.occurredAt).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const insights: Insight[] = [];

  const topEdit = topEntry(editCounts);
  insights.push({
    key: 'most-edited-file',
    label: '가장 많이 수정한 파일',
    value: topEdit ? fileName(topEdit[0]) : '데이터 없음',
    detail: topEdit ? `${topEdit[1]}회 수정됨` : 'IDE 커넥터 연결이 필요합니다',
  });

  const topWork = topEntry(workMsByFile);
  insights.push({
    key: 'longest-worked-file',
    label: '가장 오래 작업한 파일',
    value: topWork ? fileName(topWork[0]) : '데이터 없음',
    detail: topWork ? formatDuration(topWork[1]) : 'IDE 커넥터 연결이 필요합니다',
  });

  const topError = topEntry(errorCounts);
  insights.push({
    key: 'most-frequent-error',
    label: '가장 빈번한 에러',
    value: topError ? topError[0] : '데이터 없음',
    detail: topError ? `${topError[1]}회 발생` : '에러 수집 기능이 아직 없습니다',
  });

  const topWord = topEntry(wordCounts);
  insights.push({
    key: 'most-asked-topic',
    label: '가장 많이 질문한 주제',
    value: topWord ? topWord[0] : '데이터 없음',
    detail: topWord ? `AI 대화에서 ${topWord[1]}회 언급` : 'AI 대화 기록이 없습니다',
  });

  const topHour = topEntry(hourCounts);
  insights.push({
    key: 'most-productive-time',
    label: '가장 생산적인 시간대',
    value: topHour ? `${topHour[0]}시 - ${topHour[0] + 1}시` : '데이터 없음',
    detail: topHour ? `이 시간대에 활동 ${topHour[1]}건` : '활동 데이터가 없습니다',
  });

  return insights;
}

export function InsightCards({ projectId }: { projectId: string }) {
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    setInsights(null);
    fetchEvents(projectId)
      .then((events) => setInsights(buildInsights(events)))
      .catch(() => setInsights(buildInsights([])));
  }, [projectId]);

  if (!insights) {
    return (
      <div className="insight-card-group">
        <p className="empty">인사이트를 분석하는 중...</p>
      </div>
    );
  }

  return (
    <div className="insight-card-group">
      <div className="insight-header">
        <h3>인사이트</h3>
      </div>
      <div className="insight-cards">
        {insights.map((insight) => (
          <div key={insight.key} className="insight-card">
            <div className="insight-label">{insight.label}</div>
            <div className="insight-value" title={insight.value}>
              {insight.value}
            </div>
            <div className="insight-detail">{insight.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
