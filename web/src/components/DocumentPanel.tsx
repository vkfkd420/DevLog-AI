import { useEffect, useState } from 'react';
import {
  editDocument,
  fetchDocument,
  fetchDocumentVersions,
  fetchDocuments,
  finalizeDocument,
  generateWorklog,
} from '../api';
import type { DocumentDetail, DocumentSummary, DocumentVersionInfo } from '../types';

interface WorklogPayload {
  commits: number;
  files: number;
  aiQuestions: number;
  errors: number;
  troubleshooting: string;
  tomorrow: string;
  note: string;
}

// 기존 문서는 마크다운 문자열이 content에 그대로 들어있어 JSON.parse가 실패한다 —
// 그 경우 null을 반환해 아래에서 <pre>로 예전처럼 보여주고, 새로 생성된 구조화 JSON만 카드로 렌더링한다.
function parseWorklog(content: string | null): WorklogPayload | null {
  if (!content) {
    return null;
  }
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.commits !== 'number') {
      return null;
    }
    return {
      commits: parsed.commits ?? 0,
      files: parsed.files ?? 0,
      aiQuestions: parsed.aiQuestions ?? 0,
      errors: parsed.errors ?? 0,
      troubleshooting: parsed.troubleshooting ?? '',
      tomorrow: parsed.tomorrow ?? '',
      note: parsed.note ?? '',
    };
  } catch {
    return null;
  }
}

function WorklogCard({ payload }: { payload: WorklogPayload }) {
  return (
    <div className="worklog-card">
      <div className="knowledge-section">
        <div className="knowledge-section-label">오늘 작업</div>
        <ul className="knowledge-related-list">
          <li>✅ Git {payload.commits} Commit</li>
          <li>✅ IDE {payload.files} Files</li>
          <li>✅ AI {payload.aiQuestions} Questions</li>
          <li>{payload.errors > 0 ? `✅ Error ${payload.errors}건 발생` : '✅ Error 없음'}</li>
        </ul>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">트러블슈팅</div>
        <p>{payload.troubleshooting || '특별한 이슈가 없었습니다.'}</p>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">내일 해야할 일</div>
        <p>{payload.tomorrow || '제안된 작업이 없습니다.'}</p>
      </div>
      <div className="worklog-divider" />
      <div className="knowledge-section">
        <div className="knowledge-section-label">메모</div>
        <p>{payload.note || '메모가 없습니다.'}</p>
      </div>
    </div>
  );
}

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
