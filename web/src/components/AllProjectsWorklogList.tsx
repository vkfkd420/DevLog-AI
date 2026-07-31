import { useEffect, useState } from 'react';
import { deleteDocument, fetchAllWorklogDocuments, fetchDocument, fetchProjects } from '../api';
import type { DocumentDetail, DocumentSummary, Project } from '../types';
import { colorForProject } from '../projectColors';
import type { MonthCursor } from '../useMonthNav';
import { parseWorklog, WorklogCard } from './WorklogCard';

const DOCS_PAGE_SIZE = 10;

interface AllProjectsWorklogListProps {
  // Timeline과 같은 달을 보도록 부모(App)가 관리하는 월 상태를 그대로 받아서 필터링만 한다
  // (useMonthNav 참고) — 월 이동 UI는 Timeline 쪽에 하나만 있고 여기서는 중복으로 만들지 않는다.
  monthCursor: MonthCursor;
}

// 전체(통합) 대시보드에서는 업무일지 생성이 어느 프로젝트 것인지 특정할 수 없으므로,
// 생성/편집 없이 모든 프로젝트의 업무일지를 시간순으로 훑어보기만 하는 읽기 전용 목록을 보여준다.
// 특정 날짜/프로젝트로 생성하려면 대시보드에서 프로젝트를 선택하거나 달력 탭을 이용하면 된다.
// 항목을 누르면 그 자리에서 아코디언으로 펼쳐지며(여러 개 동시에 펼쳐둘 수 있음).
export function AllProjectsWorklogList({ monthCursor }: AllProjectsWorklogListProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailsCache, setDetailsCache] = useState<Map<string, DocumentDetail>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(DOCS_PAGE_SIZE);

  const reload = () => fetchAllWorklogDocuments().then(setDocuments);

  useEffect(() => {
    fetchProjects().then((data) => {
      setProjects(data);
      setSelectedProjectIds(new Set(data.map((p) => p.id)));
    });
    reload();
  }, []);

  // 월이 바뀌면(Timeline 쪽 이동 포함) 더보기 페이지를 초기화한다.
  useEffect(() => {
    setVisibleCount(DOCS_PAGE_SIZE);
  }, [monthCursor.year, monthCursor.month]);

  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const nameForProject = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const toggleProject = (id: string) => {
    setVisibleCount(DOCS_PAGE_SIZE);
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
    if (!detailsCache.has(id)) {
      setLoadingId(id);
      fetchDocument(id)
        .then((detail) => setDetailsCache((prev) => new Map(prev).set(id, detail)))
        .catch((e) => setError(String(e)))
        .finally(() => setLoadingId(null));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 업무일지를 삭제할까요? 같은 날짜로 다시 생성할 수 있습니다.')) {
      return;
    }
    setDeletingId(id);
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
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const inSelectedMonth = (periodStart: string) => {
    const d = new Date(periodStart);
    return d.getFullYear() === monthCursor.year && d.getMonth() === monthCursor.month;
  };

  const filtered = documents.filter((d) => selectedProjectIds.has(d.projectId) && inSelectedMonth(d.periodStart));
  const sorted = [...filtered].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const visible = sorted.slice(0, visibleCount);

  return (
    <section className="panel">
      <h2>
        업무일지 (전체) · {monthCursor.year}년 {monthCursor.month + 1}월
      </h2>
      <p className="empty">
        Timeline과 같은 달을 보여줍니다. 항목을 눌러 펼치면 여러 개를 한 화면에서 볼 수 있어요. 생성/편집은 프로젝트를
        선택하거나 달력 탭을 이용하세요.
      </p>
      {error && <p className="error">{error}</p>}

      {projects.length > 0 && (
        <div className="report-project-picker" style={{ marginBottom: 12 }}>
          {projects.map((project) => {
            const active = selectedProjectIds.has(project.id);
            return (
              <button
                key={project.id}
                type="button"
                className={active ? 'report-project-chip report-project-chip-active' : 'report-project-chip'}
                onClick={() => toggleProject(project.id)}
              >
                <span
                  className="calendar-legend-dot"
                  style={{ background: colorForProject(project.id, sortedProjectIds) }}
                />
                {project.name}
              </button>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="empty">이 달에는 업무일지가 없습니다.</p>
      ) : (
        visible.map((doc) => {
          const expanded = expandedIds.has(doc.id);
          const detail = detailsCache.get(doc.id);
          const worklog = detail ? parseWorklog(detail.content) : null;
          return (
            <div key={doc.id} className="session-card">
              <button className="report-group-header" onClick={() => toggleExpand(doc.id)}>
                <span className="report-group-period">
                  <span
                    className="calendar-legend-dot"
                    style={{ background: colorForProject(doc.projectId, sortedProjectIds), marginRight: 6 }}
                  />
                  {nameForProject(doc.projectId)} · {doc.periodStart.slice(0, 10)}
                </span>
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
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? '삭제 중...' : '삭제'}
                          </button>
                        </div>
                      </div>
                      {worklog ? <WorklogCard payload={worklog} /> : <pre>{detail.content}</pre>}
                    </article>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {visibleCount < sorted.length && (
        <button className="btn-secondary timeline-load-more" onClick={() => setVisibleCount((c) => c + DOCS_PAGE_SIZE)}>
          더 보기 ({sorted.length - visibleCount}개 더)
        </button>
      )}
    </section>
  );
}
