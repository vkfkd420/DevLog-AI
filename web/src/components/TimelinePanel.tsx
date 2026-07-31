import { useEffect, useRef, useState } from 'react';
import { computeCorrelation, fetchEvents, fetchSessions, generateKnowledgeFromEvent } from '../api';
import type { Project, SessionSummary, TimelineEvent } from '../types';
import { colorForProject } from '../projectColors';
import type { MonthCursor } from '../useMonthNav';

interface SessionWithProject extends SessionSummary {
  projectId: string;
}

function summarize(event: TimelineEvent): string {
  const payload = event.payload ?? {};
  switch (`${event.source}:${event.type}`) {
    case 'git:commit':
      return `커밋 "${payload.message}"`;
    case 'ide:file_edit_burst':
      return `${payload.filePath} 편집 (${payload.editCount}회)`;
    case 'ide:run':
      return `${payload.filePath} 실행 (종료 코드 ${payload.exitCode})`;
    case 'ide:debug_session':
      return `디버그 세션 (${payload.filePath ?? ''})`;
    case 'ai-chat:chat_exchange':
      return payload.question ? `AI 질문: ${String(payload.question).slice(0, 60)}` : 'AI 대화 (원문 비공개)';
    default:
      return String(event.type);
  }
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DATE_OPTS: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

// 오늘 세션은 시간만, 지난 세션은 날짜까지 보여준다. 같은 날 안에서 끝났으면 날짜를 한 번만 붙인다.
// 커밋 1개짜리 세션처럼 시작=종료 시각이면 "1:54 ~ 1:54"처럼 range를 반복하지 않고 한 번만 보여준다.
function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startTime = start.toLocaleTimeString('ko-KR', TIME_OPTS);
  const endTime = end.toLocaleTimeString('ko-KR', TIME_OPTS);

  if (start.toDateString() === end.toDateString()) {
    const prefix = isToday(start) ? '' : `${start.toLocaleDateString('ko-KR', DATE_OPTS)} `;
    if (startTime === endTime) {
      return `${prefix}${startTime}`;
    }
    return `${prefix}${startTime} ~ ${endTime}`;
  }

  const startLabel = isToday(start) ? startTime : `${start.toLocaleDateString('ko-KR', DATE_OPTS)} ${startTime}`;
  const endLabel = isToday(end) ? endTime : `${end.toLocaleDateString('ko-KR', DATE_OPTS)} ${endTime}`;
  return `${startLabel} ~ ${endLabel}`;
}

interface EventMeta {
  icon: string;
  category: string;
  subtitle: string;
}

// 소스별로 아이콘/카테고리/부제(브랜치·파일·AI 툴)를 결정한다.
// 에러(로그) 소스는 아직 Collector가 없어 이 분기는 지금은 타지 않지만,
// 나중에 로그/에러 Collector가 생기면 바로 표시된다.
function getEventMeta(event: TimelineEvent): EventMeta {
  const payload = event.payload ?? {};
  const hints = event.correlationHints ?? {};

  if (event.type === 'error' || event.source === 'log') {
    return { icon: '⚠️', category: 'Error', subtitle: String(payload.source ?? event.source) };
  }

  switch (event.source) {
    case 'git':
      return { icon: '🌿', category: 'Git', subtitle: String(hints.branch ?? payload.branch ?? '') };
    case 'ide':
      return { icon: '💻', category: 'IDE', subtitle: String(hints.filePath ?? payload.filePath ?? '') };
    case 'ai-chat': {
      const tool = payload.tool ? String(payload.tool) : '';
      return { icon: '🤖', category: 'AI', subtitle: tool ? tool.charAt(0).toUpperCase() + tool.slice(1) : 'AI' };
    }
    case 'manual':
      return { icon: '📝', category: '수동', subtitle: '' };
    default:
      return { icon: '•', category: event.source, subtitle: '' };
  }
}

interface EventCardProps {
  event: TimelineEvent;
  projectName: string;
  knowledgeBusy: boolean;
  knowledgeDone: boolean;
  onCreateKnowledge: (eventId: string) => void;
}

function EventCard({ event, projectName, knowledgeBusy, knowledgeDone, onCreateKnowledge }: EventCardProps) {
  const meta = getEventMeta(event);
  const [filesOpen, setFilesOpen] = useState(false);
  const isCommit = event.source === 'git' && event.type === 'commit';
  const payload = event.payload ?? {};
  const files = isCommit && Array.isArray(payload.files) ? (payload.files as string[]) : [];
  const hash = isCommit && typeof payload.hash === 'string' ? payload.hash : null;

  return (
    <li>
      <div className="timeline-row">
        <span className="badge">
          {meta.icon} {meta.category}
        </span>
        <span className="time">{new Date(event.occurredAt).toLocaleString('ko-KR')}</span>
        <span className="event-project">{projectName}</span>
      </div>
      {meta.subtitle && <div className="event-subtitle">{meta.subtitle}</div>}
      <span className="summary">{summarize(event)}</span>
      {isCommit && (
        <div className="commit-meta">
          {hash && <span className="commit-hash">{hash.slice(0, 7)}</span>}
          {files.length > 0 && (
            <button className="link commit-files-toggle" onClick={() => setFilesOpen((open) => !open)}>
              {files.length}개 파일 변경 {filesOpen ? '▲' : '▼'}
            </button>
          )}
        </div>
      )}
      {isCommit && filesOpen && (
        <ul className="commit-file-list">
          {files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      )}
      {event.source === 'ai-chat' && (
        <button
          className="btn-secondary knowledge-cta"
          onClick={() => onCreateKnowledge(event.id)}
          disabled={knowledgeBusy || knowledgeDone}
        >
          {knowledgeDone ? '지식 항목 생성됨' : knowledgeBusy ? '생성 중...' : 'Knowledge로 만들기'}
        </button>
      )}
    </li>
  );
}

interface TimelinePanelProps {
  // projectId를 생략하면(전체 보기) 알고 있는 모든 프로젝트의 세션/이벤트를 시간순으로 합쳐서 보여준다.
  projectId?: string;
  projects: Project[];
  onNavigateToConnectors: () => void;
  // 월 이동 상태는 부모(App)가 소유한다 — 업무일지(전체) 목록과 같은 달을 보게 하기 위함(useMonthNav 참고).
  monthCursor: MonthCursor;
  pickingMonth: boolean;
  setPickingMonth: (v: boolean) => void;
  shiftMonth: (delta: number) => void;
  jumpToYear: (year: number) => void;
  jumpToMonth: (month: number) => void;
  autoJumpToLatest: (dateStr: string | undefined) => void;
}

export function TimelinePanel({
  projectId,
  projects,
  onNavigateToConnectors,
  monthCursor,
  pickingMonth,
  setPickingMonth,
  shiftMonth,
  jumpToYear,
  jumpToMonth,
  autoJumpToLatest,
}: TimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [sessions, setSessions] = useState<SessionWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [knowledgeBusyIds, setKnowledgeBusyIds] = useState<Set<string>>(new Set());
  const [knowledgeDoneIds, setKnowledgeDoneIds] = useState<Set<string>>(new Set());
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const SESSIONS_PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(SESSIONS_PAGE_SIZE);

  const isCombined = !projectId;
  const targetProjectIds = projectId ? [projectId] : projects.map((p) => p.id);
  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const load = () => {
    setLoading(true);
    setError(null);
    return Promise.all([
      fetchEvents(projectId),
      Promise.all(
        targetProjectIds.map((id) => fetchSessions(id).then((list) => list.map((s) => ({ ...s, projectId: id })))),
      ),
    ])
      .then(([eventData, sessionsPerProject]) => {
        setEvents([...eventData].reverse());
        const merged = sessionsPerProject.flat().sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
        setSessions(merged);
        autoJumpToLatest(merged[0]?.startAt);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setExpanded(new Set());
    setVisibleCount(SESSIONS_PAGE_SIZE);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projects.length]);

  // 월이 바뀌면(공유 상태이므로 업무일지 목록 쪽 이동으로도 바뀔 수 있다) 더보기 페이지도 초기화한다.
  useEffect(() => {
    setVisibleCount(SESSIONS_PAGE_SIZE);
  }, [monthCursor.year, monthCursor.month]);

  // 연/월 picker가 열려있을 때 바깥을 클릭하면 선택 안 해도 그냥 닫히게 한다.
  useEffect(() => {
    if (!pickingMonth) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setPickingMonth(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickingMonth, setPickingMonth]);

  const inSelectedMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getFullYear() === monthCursor.year && d.getMonth() === monthCursor.month;
  };

  const monthSessions = sessions.filter((s) => inSelectedMonth(s.startAt));

  // 멀리 있는 날짜로 한 번에 점프할 수 있도록, 실제 활동 기록이 있는 연도 범위로 선택지를 만든다.
  const sessionYears = sessions.map((s) => new Date(s.startAt).getFullYear());
  const yearRangeMax = Math.max(monthCursor.year, new Date().getFullYear(), ...sessionYears);
  const yearRangeMin = sessionYears.length > 0 ? Math.min(monthCursor.year, ...sessionYears) : monthCursor.year;
  const yearOptions: number[] = [];
  for (let y = yearRangeMax; y >= yearRangeMin; y--) {
    yearOptions.push(y);
  }

  const handleRecompute = async () => {
    setRecomputing(true);
    setError(null);
    try {
      for (const id of targetProjectIds) {
        await computeCorrelation(id);
      }
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRecomputing(false);
    }
  };

  const toggleSession = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const eventsBySession = (sessionId: string) => events.filter((event) => event.sessionId === sessionId);
  const unclustered = events.filter((event) => !event.sessionId && inSelectedMonth(event.occurredAt));

  const handleCreateKnowledge = async (eventId: string) => {
    setKnowledgeBusyIds((prev) => new Set(prev).add(eventId));
    setError(null);
    try {
      await generateKnowledgeFromEvent(eventId);
      setKnowledgeDoneIds((prev) => new Set(prev).add(eventId));
    } catch (e) {
      setError(String(e));
    } finally {
      setKnowledgeBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  return (
    <section className="panel">
      <div className="panel-toolbar">
        <h2>Timeline</h2>
        <button className="btn-secondary" onClick={handleRecompute} disabled={recomputing}>
          {recomputing ? '계산 중...' : '세션 재계산'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">불러오는 중...</p>
      ) : events.length === 0 ? (
        <div className="timeline-empty">
          <p className="empty">
            아직 연결된 데이터가 없습니다. Git, IDE 등 커넥터를 연결하면 활동이 자동으로 기록됩니다.
          </p>
          <button className="connect-cta" onClick={onNavigateToConnectors}>
            커넥터 연결
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="timeline-empty">
          <p className="empty">아직 세션이 계산되지 않았습니다. 기록된 이벤트 {events.length}건이 있습니다.</p>
          <button className="connect-cta" onClick={handleRecompute} disabled={recomputing}>
            {recomputing ? '계산 중...' : '세션 계산하기'}
          </button>
        </div>
      ) : (
        <>
          <div className="calendar-header timeline-month-nav">
            <button className="btn-secondary" onClick={() => shiftMonth(-1)}>
              이전
            </button>
            {pickingMonth ? (
              <div className="timeline-month-picker" ref={monthPickerRef}>
                <select value={monthCursor.year} onChange={(e) => jumpToYear(Number(e.target.value))}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select value={monthCursor.month} onChange={(e) => jumpToMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <h2 className="timeline-month-label" onClick={() => setPickingMonth(true)}>
                {monthCursor.year}년 {monthCursor.month + 1}월
              </h2>
            )}
            <button className="btn-secondary" onClick={() => shiftMonth(1)}>
              다음
            </button>
          </div>

          {monthSessions.length === 0 && unclustered.length === 0 && (
            <p className="empty">이 달에는 활동 기록이 없습니다.</p>
          )}

          {monthSessions.slice(0, visibleCount).map((session) => (
            <div key={session.id} className="session-card">
              <button className="session-header" onClick={() => toggleSession(session.id)}>
                <div className="session-header-main">
                  <span className="session-number">Session #{session.sessionNumber}</span>
                  <span className="session-time">{formatTimeRange(session.startAt, session.endAt)}</span>
                </div>
                <div className="session-title-row">
                  {isCombined && (
                    <span className="calendar-legend-item">
                      <span
                        className="calendar-legend-dot"
                        style={{ background: colorForProject(session.projectId, sortedProjectIds) }}
                      />
                      {projectNameById.get(session.projectId) ?? session.projectId}
                    </span>
                  )}
                  <div className="session-title">{session.title}</div>
                </div>
                <div className="session-counts">
                  <span>{session.eventCount} Events</span>
                  <span>{session.commitCount} Commits</span>
                  <span>{session.aiQuestionCount} AI Questions</span>
                  <span>{session.errorCount} Errors</span>
                </div>
              </button>
              {expanded.has(session.id) && (
                <ul className="timeline-list session-events">
                  {eventsBySession(session.id).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      projectName={projectNameById.get(event.projectId ?? '') ?? '알 수 없음'}
                      knowledgeBusy={knowledgeBusyIds.has(event.id)}
                      knowledgeDone={knowledgeDoneIds.has(event.id)}
                      onCreateKnowledge={handleCreateKnowledge}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}

          {visibleCount < monthSessions.length && (
            <button
              className="btn-secondary timeline-load-more"
              onClick={() => setVisibleCount((c) => c + SESSIONS_PAGE_SIZE)}
            >
              더 보기 ({monthSessions.length - visibleCount}개 더)
            </button>
          )}

          {unclustered.length > 0 && (
            <div className="session-card">
              <div className="session-header session-header-static">
                <div className="session-title">미분류 이벤트 ({unclustered.length})</div>
              </div>
              <ul className="timeline-list session-events">
                {unclustered.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectName={projectNameById.get(event.projectId ?? '') ?? '알 수 없음'}
                    knowledgeBusy={knowledgeBusyIds.has(event.id)}
                    knowledgeDone={knowledgeDoneIds.has(event.id)}
                    onCreateKnowledge={handleCreateKnowledge}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
