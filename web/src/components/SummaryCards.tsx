import { useEffect, useState } from 'react';
import { fetchAllWorklogDocuments, fetchDocuments, fetchEvents } from '../api';
import type { DocumentSummary, TimelineEvent } from '../types';

interface DayStats {
  workMs: number;
  files: Set<string>;
  commits: number;
  aiQuestions: number;
  errors: number;
  worklogs: number;
}

function emptyDayStats(): DayStats {
  return { workMs: 0, files: new Set(), commits: 0, aiQuestions: 0, errors: 0, worklogs: 0 };
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes}분` : `${hours}시간 ${minutes}분`;
}

// 에러(로그) 소스는 아직 어떤 Collector도 만들지 않아 항상 0으로 집계된다.
// 나중에 로그/에러 Collector가 생기면 이 판별만 채우면 카드가 그대로 동작한다.
function isErrorEvent(event: TimelineEvent): boolean {
  return event.type === 'error' || event.source === 'log';
}

interface MetricDef {
  key: string;
  label: string;
  numeric: (s: DayStats) => number;
  formatValue: (n: number) => string;
}

const METRICS: MetricDef[] = [
  {
    key: 'work',
    label: '오늘 작업시간',
    numeric: (s) => s.workMs,
    formatValue: (n) => (n > 0 ? formatDuration(n) : '0분'),
  },
  { key: 'files', label: '수정한 파일 수', numeric: (s) => s.files.size, formatValue: (n) => String(Math.round(n)) },
  { key: 'commits', label: 'Git Commit 수', numeric: (s) => s.commits, formatValue: (n) => String(Math.round(n)) },
  { key: 'ai', label: 'AI 질문 수', numeric: (s) => s.aiQuestions, formatValue: (n) => String(Math.round(n)) },
  { key: 'errors', label: '해결한 에러 수', numeric: (s) => s.errors, formatValue: (n) => String(Math.round(n)) },
  {
    key: 'worklogs',
    label: '생성된 업무일지 수',
    numeric: (s) => s.worklogs,
    formatValue: (n) => String(Math.round(n)),
  },
];

export function SummaryCards({ projectId }: { projectId?: string }) {
  const [buckets, setBuckets] = useState<Map<string, DayStats> | null>(null);

  useEffect(() => {
    setBuckets(null);
    Promise.all([fetchEvents(projectId), projectId ? fetchDocuments(projectId) : fetchAllWorklogDocuments()])
      .then(([events, documents]) => setBuckets(buildBuckets(events, documents)))
      .catch(() => setBuckets(new Map()));
  }, [projectId]);

  if (!buckets) {
    return (
      <div className="summary-cards">
        <p className="empty">요약 정보를 불러오는 중...</p>
      </div>
    );
  }

  const today = new Date();
  const todayKey = localDateKey(today.toISOString());
  const yesterdayKey = localDateKey(addDays(today, -1).toISOString());
  const weekKeys = Array.from({ length: 7 }, (_, i) => localDateKey(addDays(today, -1 - i).toISOString()));

  const todayStats = buckets.get(todayKey) ?? emptyDayStats();
  const yesterdayStats = buckets.get(yesterdayKey) ?? emptyDayStats();

  return (
    <div className="summary-cards">
      {METRICS.map((metric) => {
        const todayValue = metric.numeric(todayStats);
        const yesterdayValue = metric.numeric(yesterdayStats);
        const weekAvg =
          weekKeys.reduce((sum, key) => sum + metric.numeric(buckets.get(key) ?? emptyDayStats()), 0) /
          weekKeys.length;

        let deltaLabel: string;
        let deltaClass: 'positive' | 'negative' | 'neutral';
        if (yesterdayValue === 0) {
          deltaLabel = todayValue === 0 ? '어제와 동일' : '어제 대비 신규';
          deltaClass = todayValue === 0 ? 'neutral' : 'positive';
        } else {
          const pct = Math.round(((todayValue - yesterdayValue) / yesterdayValue) * 100);
          deltaLabel = `어제 대비 ${pct >= 0 ? '+' : ''}${pct}%`;
          deltaClass = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
        }

        return (
          <div key={metric.key} className="summary-card">
            <div className="summary-card-label">{metric.label}</div>
            <div className="summary-card-value">{metric.formatValue(todayValue)}</div>
            <div className={`summary-card-delta ${deltaClass}`}>{deltaLabel}</div>
            <div className="summary-card-subtext">이번 주 평균 {metric.formatValue(weekAvg)}</div>
          </div>
        );
      })}
    </div>
  );
}

function buildBuckets(events: TimelineEvent[], documents: DocumentSummary[]): Map<string, DayStats> {
  const buckets = new Map<string, DayStats>();
  const getBucket = (key: string): DayStats => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptyDayStats();
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const event of events) {
    const bucket = getBucket(localDateKey(event.occurredAt));
    const durationMs = (event.payload as { durationMs?: number } | undefined)?.durationMs;
    if (event.source === 'ide' && typeof durationMs === 'number') {
      bucket.workMs += durationMs;
    }
    const filePath =
      (event.correlationHints?.filePath as string | undefined) ??
      ((event.payload as { filePath?: string } | undefined)?.filePath);
    if (filePath) {
      bucket.files.add(filePath);
    }
    if (event.source === 'git' && event.type === 'commit') {
      bucket.commits += 1;
    }
    if (event.source === 'ai-chat' && event.type === 'chat_exchange') {
      bucket.aiQuestions += 1;
    }
    if (isErrorEvent(event)) {
      bucket.errors += 1;
    }
  }

  for (const doc of documents) {
    const bucket = getBucket(localDateKey(doc.createdAt));
    bucket.worklogs += 1;
  }

  return buckets;
}
