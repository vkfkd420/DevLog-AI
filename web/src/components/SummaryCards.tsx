import { useEffect, useState } from 'react';
import { fetchAllWorklogDocuments, fetchDocuments, fetchEvents } from '../api';
import type { DocumentSummary, TimelineEvent } from '../types';

interface DayStats {
  files: Set<string>;
  commits: number;
  sessionIds: Set<string>;
  errors: number;
  worklogs: number;
}

function emptyDayStats(): DayStats {
  return { files: new Set(), commits: 0, sessionIds: new Set(), errors: 0, worklogs: 0 };
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

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  return localDateKey(date.toISOString());
}

// 오늘 기록이 아직 없어도 스트릭이 끊긴 것으로 보이지 않도록, 어제부터 거슬러 올라가며 센다.
function computeStreak(datesWithActivity: Set<string>, todayKey: string): number {
  let streak = 0;
  let cursorKey = datesWithActivity.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (datesWithActivity.has(cursorKey)) {
    streak += 1;
    cursorKey = shiftDateKey(cursorKey, -1);
  }
  return streak;
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
  { key: 'files', label: '수정한 파일 수', numeric: (s) => s.files.size, formatValue: (n) => String(Math.round(n)) },
  { key: 'commits', label: 'Git Commit 수', numeric: (s) => s.commits, formatValue: (n) => String(Math.round(n)) },
  {
    key: 'sessions',
    label: '작업 세션 수',
    numeric: (s) => s.sessionIds.size,
    formatValue: (n) => String(Math.round(n)),
  },
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
  const streak = computeStreak(new Set(buckets.keys()), todayKey);

  return (
    <div className="summary-cards">
      <div className="summary-card">
        <div className="summary-card-label">연속 활동일</div>
        <div className="summary-card-value">{streak}일</div>
        <div className="summary-card-subtext">🔥 오늘까지 {streak}일째 기록 중</div>
      </div>
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
    const filePath =
      (event.correlationHints?.filePath as string | undefined) ??
      ((event.payload as { filePath?: string } | undefined)?.filePath);
    if (filePath) {
      bucket.files.add(filePath);
    }
    if (event.source === 'git' && event.type === 'commit') {
      bucket.commits += 1;
    }
    if (event.sessionId) {
      bucket.sessionIds.add(event.sessionId);
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
