// web/src/components/ReportPanel.tsx의 날짜 프리셋 계산과 동일한 로직.

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + delta));
}

// periodEnd는 저장 시 "마지막 날 다음날 00:00"(exclusive)로 취급되므로, 화면 표시에는 하루 빼서 보여준다.
export function shiftDayBack(dateKey: string): string {
  return addDays(dateKey, -1);
}

export type ReportPreset = 'week' | 'lastWeek' | 'month' | 'lastMonth';

export function presetRange(preset: ReportPreset): [string, string] {
  const today = toDateKey(new Date());
  const dow = new Date().getDay();

  switch (preset) {
    case 'week':
      return [addDays(today, -dow), today];
    case 'lastWeek': {
      const lastSunday = addDays(today, -dow - 7);
      return [lastSunday, addDays(lastSunday, 6)];
    }
    case 'month': {
      const now = new Date();
      const start = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
      return [start, today];
    }
    case 'lastMonth': {
      const now = new Date();
      const start = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const end = toDateKey(new Date(now.getFullYear(), now.getMonth(), 0));
      return [start, end];
    }
  }
}
