import { useEffect, useState } from 'react';
import {
  deleteDocument,
  editDocument,
  fetchDocument,
  fetchDocumentVersions,
  fetchDocuments,
  finalizeDocument,
  generateWorklog,
} from '../api';
import type { DocumentDetail, DocumentSummary, DocumentVersionInfo } from '../types';
import { parseWorklog, WorklogCard } from './WorklogCard';

// "업무일지 (전체)" 목록과 같은 아코디언 UI를 쓴다 — 항목을 눌러 그 자리에서 펼치고,
// 여러 개를 동시에 펼쳐둘 수 있다. 편집/버전 이력만 한 번에 하나씩만 열리게 해서 폼 상태가 꼬이지 않게 한다.
export function DocumentPanel({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailsCache, setDetailsCache] = useState<Map<string, DocumentDetail>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [changeNote, setChangeNote] = useState('');

  const [showVersionsId, setShowVersionsId] = useState<string | null>(null);
  const [versionsCache, setVersionsCache] = useState<Map<string, DocumentVersionInfo[]>>(new Map());

  const reload = () => fetchDocuments(projectId).then(setDocuments);

  useEffect(() => {
    setExpandedIds(new Set());
    setDetailsCache(new Map());
    setEditingId(null);
    setShowVersionsId(null);
    setVersionsCache(new Map());
    setError(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const ensureDetail = (id: string) => {
    if (detailsCache.has(id)) return;
    setLoadingId(id);
    fetchDocument(id)
      .then((detail) => setDetailsCache((prev) => new Map(prev).set(id, detail)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingId(null));
  };

  const toggleExpand = (id: string) => {
    setError(null);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    ensureDetail(id);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWorklog(projectId, date);
      await reload();
      setExpandedIds((prev) => new Set(prev).add(result.documentId));
      const detail = await fetchDocument(result.documentId);
      setDetailsCache((prev) => new Map(prev).set(result.documentId, detail));
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = (id: string, detail: DocumentDetail) => {
    setEditingId(id);
    setEditContent(detail.content ?? '');
    setChangeNote('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setChangeNote('');
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await editDocument(id, editContent, changeNote.trim() || undefined);
      const fresh = await fetchDocument(id);
      setDetailsCache((prev) => new Map(prev).set(id, fresh));
      setEditingId(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleFinalize = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await finalizeDocument(id);
      const fresh = await fetchDocument(id);
      setDetailsCache((prev) => new Map(prev).set(id, fresh));
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 업무일지를 삭제할까요? 같은 날짜로 다시 생성할 수 있습니다.')) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await deleteDocument(id);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDetailsCache((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      if (editingId === id) cancelEdit();
      if (showVersionsId === id) setShowVersionsId(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleVersions = async (id: string) => {
    if (showVersionsId === id) {
      setShowVersionsId(null);
      return;
    }
    if (!versionsCache.has(id)) {
      try {
        const data = await fetchDocumentVersions(id);
        setVersionsCache((prev) => new Map(prev).set(id, data));
      } catch (e) {
        setError(String(e));
        return;
      }
    }
    setShowVersionsId(id);
  };

  const sorted = [...documents].sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <section className="panel">
      <h2>업무일지</h2>
      <div className="generate-form">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={handleGenerate} disabled={generating}>
          {generating ? '생성 중...' : '오늘 일지 생성'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {sorted.length === 0 ? (
        <p className="empty">생성된 업무일지가 없습니다.</p>
      ) : (
        sorted.map((doc) => {
          const expanded = expandedIds.has(doc.id);
          const detail = detailsCache.get(doc.id);
          const worklog = detail ? parseWorklog(detail.content) : null;
          const isEditing = editingId === doc.id;
          const showingVersions = showVersionsId === doc.id;

          return (
            <div key={doc.id} className="session-card">
              <button className="report-group-header" onClick={() => toggleExpand(doc.id)}>
                <span className="report-group-period">{doc.periodStart.slice(0, 10)}</span>
                <span className="report-group-projects">
                  <span className={`status-badge ${doc.status === 'final' ? 'enabled' : 'disabled'}`}>
                    {doc.status === 'final' ? '확정' : '초안'}
                  </span>
                </span>
                <span className="report-group-toggle">{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="report-group-body">
                  {loadingId === doc.id || !detail ? (
                    <p className="empty">불러오는 중...</p>
                  ) : (
                    <article className="document-content">
                      <div className="document-content-header">
                        <span className={`status-badge ${detail.status === 'final' ? 'enabled' : 'disabled'}`}>
                          {detail.status === 'final' ? '확정' : '초안'}
                        </span>
                        <div className="document-actions">
                          {detail.status === 'draft' && !isEditing && (
                            <button onClick={() => startEdit(doc.id, detail)}>편집</button>
                          )}
                          {detail.status === 'draft' && (
                            <button onClick={() => handleFinalize(doc.id)} disabled={busyId === doc.id}>
                              확정
                            </button>
                          )}
                          <button onClick={() => toggleVersions(doc.id)}>
                            {showingVersions ? '버전 이력 숨기기' : '버전 이력 보기'}
                          </button>
                          <button className="btn-danger" onClick={() => handleDelete(doc.id)} disabled={busyId === doc.id}>
                            삭제
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="edit-form">
                          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={12} />
                          <input
                            placeholder="변경 사유 (선택)"
                            value={changeNote}
                            onChange={(e) => setChangeNote(e.target.value)}
                          />
                          <div className="edit-actions">
                            <button onClick={() => saveEdit(doc.id)} disabled={busyId === doc.id}>
                              저장
                            </button>
                            <button onClick={cancelEdit} disabled={busyId === doc.id}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : worklog ? (
                        <WorklogCard payload={worklog} />
                      ) : (
                        <pre>{detail.content}</pre>
                      )}

                      {showingVersions && versionsCache.get(doc.id) && (
                        <div className="version-history">
                          <h3>버전 이력</h3>
                          {versionsCache.get(doc.id)!.map((version) => (
                            <div key={version.id} className="version-item">
                              <span className="version-tag">v{version.versionNumber}</span>
                              <span>{version.generatedBy === 'ai_generated' ? 'AI 생성' : '사용자 편집'}</span>
                              <span className="time">{new Date(version.createdAt).toLocaleString('ko-KR')}</span>
                              {version.changeNote && <span className="change-note">{version.changeNote}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
