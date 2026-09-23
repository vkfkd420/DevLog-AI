import type { DocumentSummary, TimelineEvent } from './types';

// web/src/components/SummaryCards.tsx와 동일한 집계 로직(일자별 버킷 + 스트릭 + 전일 대비/주간 평균).

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

function computeStreak(datesWithActivity: Set<string>, todayKey: string): number {
  let streak = 0;
  let cursorKey = datesWithActivity.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (datesWithActivity.has(cursorKey)) {
    streak += 1;
    cursorKey = shiftDateKey(cursorKey, -1);
  }
  return streak;
}

function isErrorEvent(event: TimelineEvent): boolean {
  return event.type === 'error' || event.source === 'log';
}

interface MetricDef {
  key: string;
  label: string;
  numeric: (s: DayStats) => number;
}

const METRICS: MetricDef[] = [
  { key: 'files', label: '수정한 파일 수', numeric: (s) => s.files.size },
  { key: 'commits', label: 'Git Commit 수', numeric: (s) => s.commits },
  { key: 'sessions', label: '작업 세션 수', numeric: (s) => s.sessionIds.size },
  { key: 'errors', label: '해결한 에러 수', numeric: (s) => s.errors },
  { key: 'worklogs', label: '생성된 업무일지 수', numeric: (s) => s.worklogs },
];

export interface SummaryCard {
  label: string;
  value: string;
  deltaLabel: string;
  weekAvgLabel: string;
}

export interface SummaryResult {
  streak: number;
  cards: SummaryCard[];
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
    if (filePath) bucket.files.add(filePath);
    if (event.source === 'git' && event.type === 'commit') bucket.commits += 1;
    if (event.sessionId) bucket.sessionIds.add(event.sessionId);
    if (isErrorEvent(event)) bucket.errors += 1;
  }

  for (const doc of documents) {
    const bucket = getBucket(localDateKey(doc.createdAt));
    bucket.worklogs += 1;
  }

  return buckets;
}

export function buildSummary(events: TimelineEvent[], documents: DocumentSummary[]): SummaryResult {
  const buckets = buildBuckets(events, documents);

  const today = new Date();
  const todayKey = localDateKey(today.toISOString());
  const yesterdayKey = localDateKey(addDays(today, -1).toISOString());
  const weekKeys = Array.from({ length: 7 }, (_, i) => localDateKey(addDays(today, -1 - i).toISOString()));

  const todayStats = buckets.get(todayKey) ?? emptyDayStats();
  const yesterdayStats = buckets.get(yesterdayKey) ?? emptyDayStats();
  const streak = computeStreak(new Set(buckets.keys()), todayKey);

  const cards = METRICS.map((metric) => {
    const todayValue = metric.numeric(todayStats);
    const yesterdayValue = metric.numeric(yesterdayStats);
    const weekAvg = weekKeys.reduce((sum, key) => sum + metric.numeric(buckets.get(key) ?? emptyDayStats()), 0) / weekKeys.length;

    let deltaLabel: string;
    if (yesterdayValue === 0) {
      deltaLabel = todayValue === 0 ? '어제와 동일' : '어제 대비 신규';
    } else {
      const pct = Math.round(((todayValue - yesterdayValue) / yesterdayValue) * 100);
      deltaLabel = `어제 대비 ${pct >= 0 ? '+' : ''}${pct}%`;
    }

    return {
      label: metric.label,
      value: String(Math.round(todayValue)),
      deltaLabel,
      weekAvgLabel: `이번 주 평균 ${Math.round(weekAvg)}`,
    };
  });

  return { streak, cards };
}
