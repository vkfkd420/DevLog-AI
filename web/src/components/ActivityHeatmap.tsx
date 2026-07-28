import { useEffect, useState } from 'react';
import { fetchEvents } from '../api';

const WEEKS = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DayCell {
  date: Date;
  key: string;
  count: number;
}

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

function buildWeeks(counts: Map<string, number>): DayCell[][] {
  const today = startOfDay(new Date());
  let gridStart = addDays(today, -(WEEKS * 7 - 1));
  while (gridStart.getDay() !== 0) {
    gridStart = addDays(gridStart, -1);
  }

  const totalDays = Math.round((today.getTime() - gridStart.getTime()) / DAY_MS) + 1;
  const days: DayCell[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(gridStart, i);
    const key = dateKey(date);
    days.push({ date, key, count: counts.get(key) ?? 0 });
  }
  // 그리드가 항상 7의 배수가 되도록 이번 주의 남은 날짜를 미래(빈 칸)로 채운다.
  while (days.length % 7 !== 0) {
    const date = addDays(days[days.length - 1].date, 1);
    days.push({ date, key: dateKey(date), count: -1 });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
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

export function ActivityHeatmap({ projectId }: { projectId: string }) {
  const [counts, setCounts] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    setCounts(null);
    fetchEvents(projectId)
      .then((events) => {
        const map = new Map<string, number>();
        for (const event of events) {
          const key = dateKey(new Date(event.occurredAt));
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        setCounts(map);
      })
      .catch(() => setCounts(new Map()));
  }, [projectId]);

  if (!counts) {
    return (
      <div className="heatmap-card">
        <p className="empty">활동 히트맵을 불러오는 중...</p>
      </div>
    );
  }

  const weeks = buildWeeks(counts);
  const max = Math.max(0, ...weeks.flat().map((d) => d.count));
  let lastMonth = -1;

  return (
    <div className="heatmap-card">
      <div className="heatmap-header">
        <h3>활동 히트맵</h3>
        <span className="heatmap-subtitle">최근 {WEEKS}주</span>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-grid">
          {weeks.map((week, wi) => {
            const firstValid = week.find((d) => d.count !== -1) ?? week[0];
            const month = firstValid.date.getMonth();
            const showLabel = month !== lastMonth;
            if (showLabel) {
              lastMonth = month;
            }
            return (
              <div key={wi} className="heatmap-week">
                <div className="heatmap-month-label">{showLabel ? `${month + 1}월` : ''}</div>
                <div className="heatmap-days">
                  {week.map((day) =>
                    day.count === -1 ? (
                      <div key={day.key} className="heatmap-day heatmap-day-empty" />
                    ) : (
                      <div
                        key={day.key}
                        className={`heatmap-day heatmap-level-${levelFor(day.count, max)}`}
                        title={`${day.key} · ${day.count}개 활동`}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>적음</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div key={level} className={`heatmap-day heatmap-level-${level}`} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
