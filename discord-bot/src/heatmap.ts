import type { TimelineEvent } from './types';

// web/src/components/ActivityHeatmap.tsx와 동일한 집계(최근 18주, 일요일 시작 주 단위 그리드).
const WEEKS = 18;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
// 활동 없음(0) / 낮음~높음(1~4)을 진하기가 다른 블록 문자로 표현한다 — 디스코드 메시지엔 컬러 그라데이션이
// 없어서, 터미널 히트맵에서 흔히 쓰는 음영 블록(░▒▓█)으로 강도를 대신 나타낸다.
const LEVEL_CHARS = ['·', '░', '▒', '▓', '█'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function levelFor(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export interface HeatmapResult {
  grid: string;
  totalActivity: number;
  rangeLabel: string;
}

export function buildHeatmap(events: TimelineEvent[]): HeatmapResult {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = dateKey(new Date(event.occurredAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfDay(new Date());
  let gridStart = addDays(today, -(WEEKS * 7 - 1));
  while (gridStart.getDay() !== 0) {
    gridStart = addDays(gridStart, -1);
  }

  const totalDays = Math.round((today.getTime() - gridStart.getTime()) / DAY_MS) + 1;
  // day.count === -1은 이번 주의 아직 오지 않은 미래 날짜(패딩)를 뜻한다.
  const days: { key: string; count: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(gridStart, i);
    days.push({ key: dateKey(date), count: counts.get(dateKey(date)) ?? 0 });
  }
  while (days.length % 7 !== 0) {
    days.push({ key: '', count: -1 });
  }

  const weeks: { key: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const max = Math.max(0, ...days.map((d) => d.count));
  const totalActivity = days.reduce((sum, d) => sum + Math.max(0, d.count), 0);

  const lines = WEEKDAY_LABELS.map((label, weekday) => {
    const row = weeks
      .map((week) => {
        const day = week[weekday];
        if (!day || day.count === -1) return ' ';
        return LEVEL_CHARS[levelFor(day.count, max)];
      })
      .join('');
    return `${label} ${row}`;
  });

  return {
    grid: lines.join('\n'),
    totalActivity,
    rangeLabel: `${gridStart.toISOString().slice(0, 10)} ~ ${today.toISOString().slice(0, 10)}`,
  };
}
