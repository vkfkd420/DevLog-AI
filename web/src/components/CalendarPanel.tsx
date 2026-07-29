import { useEffect, useState } from 'react';
import { deleteDocument, fetchAllWorklogDocuments, fetchDocument, fetchDocuments, fetchProjects, generateWorklog } from '../api';
import type { DocumentDetail, DocumentSummary, Project } from '../types';
import { parseWorklog, WorklogCard } from './WorklogCard';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 프로젝트마다 구분되는 점 색상을 부여하기 위한 팔레트. 앱의 웜톤에 어울리면서도
// 서로 색상이 뚜렷이 구분되도록 골랐다. 프로젝트가 팔레트보다 많으면 순환한다.
const PROJECT_COLORS = ['#d97757', '#6b9080', '#6c8ead', '#cf9d3f', '#9b6b9e', '#7d8597'];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

// 오늘 기록이 아직 없어도 스트릭이 끊긴 것으로 보이지 않도록, 어제부터 거슬러 올라가며 센다.
function computeStreak(datesWithEntries: Set<string>, todayKey: string): number {
  let streak = 0;
  let cursorKey = datesWithEntries.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (datesWithEntries.has(cursorKey)) {
    streak += 1;
    cursorKey = shiftDateKey(cursorKey, -1);
  }
  return streak;
}

export function CalendarPanel({ projectId }: { projectId: string }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => getTodayKey());
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProjects().then(setProjects);
    fetchAllWorklogDocuments().then(setAllDocuments);
  }, []);

  useEffect(() => {
    const todayKey = getTodayKey();
    setSelectedDate(todayKey);
    setSelectedDoc(null);
    setError(null);
    fetchDocuments(projectId)
      .then((docs) => {
        setDocuments(docs);
        const todayDoc = docs.find((doc) => doc.periodStart.slice(0, 10) === todayKey);
        if (todayDoc) {
          fetchDocument(todayDoc.id).then(setSelectedDoc).catch((e) => setError(String(e)));
        }
      })
      .catch((e) => setError(String(e)));
  }, [projectId]);

  // 프로젝트별 색상은 프로젝트 id 정렬 순서로 고정 배정 — 매 렌더마다 같은 프로젝트는 항상 같은 색.
  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const colorForProject = (id: string) => PROJECT_COLORS[sortedProjectIds.indexOf(id) % PROJECT_COLORS.length];
  const nameForProject = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const docsByDate = new Map<string, DocumentSummary[]>();
  for (const doc of allDocuments) {
    const key = doc.periodStart.slice(0, 10);
    const list = docsByDate.get(key) ?? [];
    list.push(doc);
    docsByDate.set(key, list);
  }

  const docByDate = new Map(documents.map((doc) => [doc.periodStart.slice(0, 10), doc]));
  const datesWithEntries = new Set(docsByDate.keys());

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setError(null);
    const doc = docByDate.get(dateKey);
    if (doc) {
      fetchDocument(doc.id).then(setSelectedDoc).catch((e) => setError(String(e)));
    } else {
      setSelectedDoc(null);
    }
  };

  const refreshAllDocuments = () => fetchAllWorklogDocuments().then(setAllDocuments);

  const handleGenerate = async () => {
    if (!selectedDate) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWorklog(projectId, selectedDate);
      const [fresh, freshDoc] = await Promise.all([fetchDocuments(projectId), fetchDocument(result.documentId)]);
      setDocuments(fresh);
      setSelectedDoc(freshDoc);
      await refreshAllDocuments();
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    if (!window.confirm('이 업무일지를 삭제할까요? 같은 날짜로 다시 생성할 수 있습니다.')) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(selectedDoc.id);
      setSelectedDoc(null);
      const fresh = await fetchDocuments(projectId);
      setDocuments(fresh);
      await refreshAllDocuments();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayKey = getTodayKey();

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(cursor.year, cursor.month, i + 1)),
  ];

  const worklog = selectedDoc ? parseWorklog(selectedDoc.content) : null;
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const monthCount = documents.filter((doc) => doc.periodStart.slice(0, 7) === monthPrefix).length;
  const streak = computeStreak(datesWithEntries, todayKey);

  const otherProjectsToday =
    selectedDate && !selectedDoc
      ? [...new Set((docsByDate.get(selectedDate) ?? []).map((d) => d.projectId))].filter((id) => id !== projectId)
      : [];

  return (
    <div className="calendar-layout">
      <section className="panel">
        <div className="calendar-header">
          <button
            className="btn-secondary"
            onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
          >
            이전
          </button>
          <h2>
            {cursor.year}년 {cursor.month + 1}월
          </h2>
          <button
            className="btn-secondary"
            onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
          >
            다음
          </button>
        </div>

        <div className="calendar-stats">
          <span>
            이번 달 <strong>{monthCount}</strong>일 기록
          </span>
          <span>
            🔥 연속 <strong>{streak}</strong>일
          </span>
        </div>

        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
          {cells.map((dateKey, i) => {
            if (dateKey === null) {
              return <div key={`blank-${i}`} className="calendar-cell calendar-cell-empty" />;
            }
            const dayDocs = docsByDate.get(dateKey) ?? [];
            const dayProjectIds = [...new Set(dayDocs.map((d) => d.projectId))];
            return (
              <button
                key={dateKey}
                className={[
                  'calendar-cell',
                  dateKey === todayKey ? 'calendar-cell-today' : '',
                  dateKey === selectedDate ? 'calendar-cell-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelectDate(dateKey)}
                title={dayProjectIds.map(nameForProject).join(', ')}
              >
                <span>{Number(dateKey.slice(8, 10))}</span>
                {dayProjectIds.length > 0 && (
                  <span className="calendar-dot-row">
                    {dayProjectIds.slice(0, 4).map((pid) => (
                      <span key={pid} className="calendar-dot" style={{ background: colorForProject(pid) }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {sortedProjectIds.length > 1 && (
          <div className="calendar-legend">
            {projects
              .filter((p) => allDocuments.some((d) => d.projectId === p.id))
              .map((p) => (
                <span key={p.id} className="calendar-legend-item">
                  <span className="calendar-legend-dot" style={{ background: colorForProject(p.id) }} />
                  {p.name}
                </span>
              ))}
          </div>
        )}
      </section>

      {selectedDate && (
        <section className="panel">
          <div className="calendar-header">
            <h2>{selectedDate}</h2>
            {selectedDoc && (
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {worklog ? (
            <WorklogCard payload={worklog} />
          ) : selectedDoc ? (
            <pre>{selectedDoc.content}</pre>
          ) : (
            <>
              <p className="empty">이 날짜에 등록된 업무일지가 없습니다.</p>
              {otherProjectsToday.length > 0 && (
                <p className="empty">다른 프로젝트 기록: {otherProjectsToday.map(nameForProject).join(', ')}</p>
              )}
              <button onClick={handleGenerate} disabled={generating}>
                {generating ? '생성 중...' : '이 날짜 일지 생성'}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
