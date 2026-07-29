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

export function DocumentPanel({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [changeNote, setChangeNote] = useState('');

  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionInfo[] | null>(null);

  const reload = () => fetchDocuments(projectId).then(setDocuments);

  useEffect(() => {
    resetSelection();
    setError(null);
    reload();
  }, [projectId]);

  const resetSelection = () => {
    setSelected(null);
    setEditing(false);
    setShowVersions(false);
    setVersions(null);
  };

  const handleSelect = (id: string) => {
    setEditing(false);
    setShowVersions(false);
    setVersions(null);
    fetchDocument(id).then(setSelected).catch((e) => setError(String(e)));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWorklog(projectId, date);
      await reload();
      handleSelect(result.documentId);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditing(true);
    setEditContent(selected.content ?? '');
    setChangeNote('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditContent('');
    setChangeNote('');
  };

  const saveEdit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await editDocument(selected.id, editContent, changeNote.trim() || undefined);
      const fresh = await fetchDocument(selected.id);
      setSelected(fresh);
      setEditing(false);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await finalizeDocument(selected.id);
      const fresh = await fetchDocument(selected.id);
      setSelected(fresh);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm('이 업무일지를 삭제할까요? 같은 날짜로 다시 생성할 수 있습니다.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteDocument(selected.id);
      resetSelection();
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleVersions = async () => {
    if (!selected) return;
    if (!showVersions) {
      try {
        const data = await fetchDocumentVersions(selected.id);
        setVersions(data);
      } catch (e) {
        setError(String(e));
        return;
      }
    }
    setShowVersions((value) => !value);
  };

  const worklog = selected ? parseWorklog(selected.content) : null;

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

      {documents.length === 0 ? (
        <p className="empty">생성된 업무일지가 없습니다.</p>
      ) : (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button className="link" onClick={() => handleSelect(doc.id)}>
                <span>{doc.periodStart.slice(0, 10)}</span>
                <span className={`status-badge ${doc.status === 'final' ? 'enabled' : 'disabled'}`}>
                  {doc.status === 'final' ? '확정' : '초안'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <article className="document-content">
          <div className="document-content-header">
            <span className={`status-badge ${selected.status === 'final' ? 'enabled' : 'disabled'}`}>
              {selected.status === 'final' ? '확정' : '초안'}
            </span>
            <div className="document-actions">
              {selected.status === 'draft' && !editing && <button onClick={startEdit}>편집</button>}
              {selected.status === 'draft' && (
                <button onClick={handleFinalize} disabled={busy}>
                  확정
                </button>
              )}
              <button onClick={toggleVersions}>{showVersions ? '버전 이력 숨기기' : '버전 이력 보기'}</button>
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>
                삭제
              </button>
            </div>
          </div>

          {editing ? (
            <div className="edit-form">
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={12} />
              <input
                placeholder="변경 사유 (선택)"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
              <div className="edit-actions">
                <button onClick={saveEdit} disabled={busy}>
                  저장
                </button>
                <button onClick={cancelEdit} disabled={busy}>
                  취소
                </button>
              </div>
            </div>
          ) : worklog ? (
            <WorklogCard payload={worklog} />
          ) : (
            <pre>{selected.content}</pre>
          )}

          {showVersions && versions && (
            <div className="version-history">
              <h3>버전 이력</h3>
              {versions.map((version) => (
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
    </section>
  );
}
