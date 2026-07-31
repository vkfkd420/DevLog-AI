import { useRef, useState } from 'react';

export interface MonthCursor {
  year: number;
  month: number;
}

function currentMonth(): MonthCursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// Timeline과 업무일지(전체) 목록이 같은 달을 보도록 월 이동 상태를 한 곳에서 관리한다.
// 사용자가 직접 이전/다음/연월 선택으로 이동하기 전까지는, 데이터가 로드될 때마다
// 가장 최근 활동이 있는 달로 자동으로 맞춰준다 (텅 빈 화면을 보는 것을 방지).
export function useMonthNav() {
  const [monthCursor, setMonthCursor] = useState<MonthCursor>(currentMonth);
  const [pickingMonth, setPickingMonth] = useState(false);
  const userNavigated = useRef(false);

  const shiftMonth = (delta: number) => {
    userNavigated.current = true;
    setMonthCursor((c) => {
      const total = c.year * 12 + c.month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  };

  const jumpToYear = (year: number) => {
    userNavigated.current = true;
    setMonthCursor((c) => ({ ...c, year }));
  };

  const jumpToMonth = (month: number) => {
    userNavigated.current = true;
    setMonthCursor((c) => ({ ...c, month }));
    setPickingMonth(false);
  };

  const autoJumpToLatest = (dateStr: string | undefined) => {
    if (userNavigated.current || !dateStr) return;
    const d = new Date(dateStr);
    setMonthCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const reset = () => {
    userNavigated.current = false;
    setMonthCursor(currentMonth());
    setPickingMonth(false);
  };

  return { monthCursor, pickingMonth, setPickingMonth, shiftMonth, jumpToYear, jumpToMonth, autoJumpToLatest, reset };
}
