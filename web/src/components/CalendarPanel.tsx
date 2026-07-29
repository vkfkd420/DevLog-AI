import { useEffect, useState } from 'react';
import { deleteDocument, fetchDocument, fetchDocuments, generateWorklog } from '../api';
import type { DocumentDetail, DocumentSummary } from '../types';
import { parseWorklog, WorklogCard } from './WorklogCard';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarPanel({ projectId }: { projectId: string }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSelectedDate(null);
    setSelectedDoc(null);
    setError(null);
    fetchDocuments(projectId).then(setDocuments).catch((e) => setError(String(e)));
  }, [projectId]);

  const docByDate = new Map(documents.map((doc) => [doc.periodStart.slice(0, 10), doc]));

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

  const handleGenerate = async () => {
    if (!selectedDate) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWorklog(projectId, selectedDate);
      const [fresh, freshDoc] = await Promise.all([fetchDocuments(projectId), fetchDocument(result.documentId)]);
      setDocuments(fresh);
      setSelectedDoc(freshDoc);
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
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayKey = toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(cursor.year, cursor.month, i + 1)),
  ];

  const worklog = selectedDoc ? parseWorklog(selectedDoc.content) : null;

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

        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
          {cells.map((dateKey, i) =>
            dateKey === null ? (
              <div key={`blank-${i}`} className="calendar-cell calendar-cell-empty" />
            ) : (
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
              >
                <span>{Number(dateKey.slice(8, 10))}</span>
                {docByDate.has(dateKey) && <span className="calendar-dot" />}
              </button>
            ),
          )}
        </div>
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
