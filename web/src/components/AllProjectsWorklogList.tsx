import { useEffect, useState } from 'react';
import { deleteDocument, fetchAllWorklogDocuments, fetchDocument, fetchProjects } from '../api';
import type { DocumentDetail, DocumentSummary, Project } from '../types';
import { colorForProject } from '../projectColors';
import { parseWorklog, WorklogCard } from './WorklogCard';

// 전체(통합) 대시보드에서는 업무일지 생성이 어느 프로젝트 것인지 특정할 수 없으므로,
// 생성/편집 없이 모든 프로젝트의 업무일지를 시간순으로 훑어보기만 하는 읽기 전용 목록을 보여준다.
// 특정 날짜/프로젝트로 생성하려면 대시보드에서 프로젝트를 선택하거나 달력 탭을 이용하면 된다.
export function AllProjectsWorklogList() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => fetchAllWorklogDocuments().then(setDocuments);

  useEffect(() => {
    fetchProjects().then(setProjects);
    reload();
  }, []);

  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const nameForProject = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const handleSelect = (id: string) => {
    setError(null);
    fetchDocument(id).then(setSelected).catch((e) => setError(String(e)));
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
      setSelected(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const worklog = selected ? parseWorklog(selected.content) : null;
  const sorted = [...documents].sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <section className="panel">
      <h2>업무일지 (전체)</h2>
      <p className="empty">모든 프로젝트의 업무일지를 시간순으로 모아 보여줍니다. 생성/편집은 프로젝트를 선택하거나 달력 탭을 이용하세요.</p>
      {error && <p className="error">{error}</p>}

      {sorted.length === 0 ? (
        <p className="empty">생성된 업무일지가 없습니다.</p>
      ) : (
        <ul className="document-list">
          {sorted.map((doc) => (
            <li key={doc.id}>
              <button className="link" onClick={() => handleSelect(doc.id)}>
                <span>
                  <span
                    className="calendar-legend-dot"
                    style={{ background: colorForProject(doc.projectId, sortedProjectIds), marginRight: 6 }}
                  />
                  {nameForProject(doc.projectId)} · {doc.periodStart.slice(0, 10)}
                </span>
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
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>
                삭제
              </button>
            </div>
          </div>
          {worklog ? <WorklogCard payload={worklog} /> : <pre>{selected.content}</pre>}
        </article>
      )}
    </section>
  );
}
