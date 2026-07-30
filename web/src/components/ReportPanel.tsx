import { useEffect, useState } from 'react';
import { deleteDocument, fetchAllReports, fetchDocument, fetchProjects, generateReport } from '../api';
import type { DocumentDetail, DocumentSummary, Project } from '../types';
import { colorForProject } from '../projectColors';
import { parseWorklog, WorklogCard } from './WorklogCard';

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + delta));
}

// periodEnd는 저장 시 "마지막 날 다음날 00:00"(exclusive)이라, 화면엔 하루 빼서 실제 마지막 날을 보여준다.
function shiftDayBack(dateKey: string): string {
  return addDays(dateKey, -1);
}

function groupKey(periodStart: string, periodEnd: string): string {
  return `${periodStart}__${periodEnd}`;
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  {
    label: '이번 주',
    range: () => {
      const today = toDateKey(new Date());
      const dow = new Date().getDay();
      return [addDays(today, -dow), today];
    },
  },
  {
    label: '지난 주',
    range: () => {
      const today = toDateKey(new Date());
      const dow = new Date().getDay();
      const lastSunday = addDays(today, -dow - 7);
      return [lastSunday, addDays(lastSunday, 6)];
    },
  },
  {
    label: '이번 달',
    range: () => {
      const now = new Date();
      const start = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
      return [start, toDateKey(now)];
    },
  },
  {
    label: '지난 달',
    range: () => {
      const now = new Date();
      const start = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const end = toDateKey(new Date(now.getFullYear(), now.getMonth(), 0));
      return [start, end];
    },
  },
];

// 기간(시작일~종료일)을 고르면 모든 활성 프로젝트마다 그 기간의 업무를 하나의 응집된 보고서로
// 요약 생성한다. 같은 기간에 생성된 여러 프로젝트 보고서는 하나의 그룹으로 묶어서 보여주고,
// 그룹 단위로 펼치기/삭제를 할 수 있게 해 개별 문서를 일일이 열고 닫을 필요가 없게 한다.
export function ReportPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [periodStart, setPeriodStart] = useState(() => addDays(toDateKey(new Date()), -6));
  const [periodEnd, setPeriodEnd] = useState(() => toDateKey(new Date()));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const [allReports, setAllReports] = useState<DocumentSummary[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<Map<string, DocumentDetail[]>>(new Map());
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);

  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const nameForProject = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const reloadList = () => fetchAllReports().then(setAllReports);

  useEffect(() => {
    fetchProjects().then((data) => {
      setProjects(data);
      // 기본은 전부 선택된 상태로 시작 — 필요할 때만 골라서 빼면 되게.
      setSelectedProjectIds(new Set(data.map((p) => p.id)));
    });
    reloadList();
  }, []);

  const toggleProject = (id: string) => {
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

  const loadGroupDetails = (key: string, docs: DocumentSummary[]) => {
    setLoadingGroup(key);
    Promise.all(docs.map((d) => fetchDocument(d.id)))
      .then((details) => setGroupDetails((prev) => new Map(prev).set(key, details)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingGroup(null));
  };

  const toggleGroup = (key: string, docs: DocumentSummary[]) => {
    if (expandedGroup === key) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(key);
    if (!groupDetails.has(key)) {
      loadGroupDetails(key, docs);
    }
  };

  const applyPreset = (range: () => [string, string]) => {
    const [start, end] = range();
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const handleGenerate = async () => {
    setError(null);
    if (!periodStart || !periodEnd) {
      setError('시작일과 종료일을 모두 선택하세요.');
      return;
    }
    if (periodStart > periodEnd) {
      setError('시작일은 종료일보다 이후일 수 없습니다.');
      return;
    }
    const targetProjects = projects.filter((p) => selectedProjectIds.has(p.id));
    if (targetProjects.length === 0) {
      setError('보고서를 생성할 프로젝트를 하나 이상 선택하세요.');
      return;
    }
    setGenerating(true);
    try {
      const details: DocumentDetail[] = [];
      for (const project of targetProjects) {
        const result = await generateReport(project.id, periodStart, periodEnd);
        details.push(await fetchDocument(result.documentId));
      }
      const key = groupKey(details[0]?.periodStart ?? '', details[0]?.periodEnd ?? '');

      // 같은 기간에 예전에 다른 프로젝트 선택으로 만들어둔 보고서가 남아있으면, 이번에 선택
      // 안 한 프로젝트 것은 지워서 그룹이 항상 "최근에 생성한 선택"만 반영하게 한다.
      const targetIds = new Set(targetProjects.map((p) => p.id));
      const staleDocs = allReports.filter(
        (d) => groupKey(d.periodStart, d.periodEnd) === key && !targetIds.has(d.projectId),
      );
      for (const stale of staleDocs) {
        await deleteDocument(stale.id);
      }

      setGroupDetails((prev) => new Map(prev).set(key, details));
      setExpandedGroup(key);
      await reloadList();
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteGroup = async (key: string, docs: DocumentSummary[]) => {
    if (!window.confirm(`이 기간의 보고서 ${docs.length}개를 모두 삭제할까요?`)) return;
    setDeletingGroup(key);
    setError(null);
    try {
      for (const doc of docs) {
        await deleteDocument(doc.id);
      }
      if (expandedGroup === key) setExpandedGroup(null);
      setGroupDetails((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      await reloadList();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeletingGroup(null);
    }
  };

  const groups = new Map<string, DocumentSummary[]>();
  for (const doc of allReports) {
    const key = groupKey(doc.periodStart, doc.periodEnd);
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1][0].periodStart.localeCompare(a[1][0].periodStart));

  return (
    <>
      <section className="panel">
        <h2>기간 보고서 생성</h2>
        <p className="empty">
          기간과 프로젝트를 고르면 각 프로젝트의 업무를 하나의 보고서로 요약 생성합니다. 주간/월간 보고 등에
          바로 활용할 수 있어요.
        </p>
        <div className="report-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} className="btn-secondary" onClick={() => applyPreset(preset.range)}>
              {preset.label}
            </button>
          ))}
        </div>

        {projects.length > 0 && (
          <div className="settings-field" style={{ marginBottom: 12 }}>
            <span className="settings-field-label">프로젝트</span>
            <div className="report-project-picker">
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
          </div>
        )}

        <div className="connector-form">
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <span className="settings-field-label">~</span>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <button className="btn-primary" onClick={handleGenerate} disabled={generating || projects.length === 0}>
            {generating ? '생성 중...' : '보고서 생성'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {projects.length === 0 && <p className="empty">등록된 프로젝트가 없습니다.</p>}
      </section>

      <section className="panel">
        <h2>등록된 보고서</h2>
        {sortedGroups.length === 0 ? (
          <p className="empty">생성된 보고서가 없습니다.</p>
        ) : (
          sortedGroups.map(([key, docs]) => {
            const [start, end] = key.split('__');
            const finalCount = docs.filter((d) => d.status === 'final').length;
            return (
              <div key={key} className="report-group session-card">
                <button className="report-group-header" onClick={() => toggleGroup(key, docs)}>
                  <span className="report-group-period">
                    {start.slice(0, 10)} ~ {shiftDayBack(end.slice(0, 10))}
                  </span>
                  <span className="report-group-projects">
                    {docs.map((d) => (
                      <span key={d.projectId} className="calendar-legend-item">
                        <span
                          className="calendar-legend-dot"
                          style={{ background: colorForProject(d.projectId, sortedProjectIds) }}
                        />
                        {nameForProject(d.projectId)}
                      </span>
                    ))}
                    {finalCount > 0 && <span className="empty">확정 {finalCount}건</span>}
                  </span>
                  <button
                    className="btn-danger report-group-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(key, docs);
                    }}
                    disabled={deletingGroup === key}
                  >
                    {deletingGroup === key ? '삭제 중...' : '삭제'}
                  </button>
                  <span className="report-group-toggle">{expandedGroup === key ? '▲' : '▼'}</span>
                </button>

                {expandedGroup === key && (
                  <div className="report-group-body">
                    {loadingGroup === key ? (
                      <p className="empty">불러오는 중...</p>
                    ) : (
                      (groupDetails.get(key) ?? []).map((doc) => {
                        const worklog = parseWorklog(doc.content);
                        return (
                          <article key={doc.id} className="document-content">
                            <div className="document-content-header">
                              <span className="calendar-legend-item">
                                <span
                                  className="calendar-legend-dot"
                                  style={{ background: colorForProject(doc.projectId, sortedProjectIds) }}
                                />
                                {nameForProject(doc.projectId)}
                              </span>
                              <span className={`status-badge ${doc.status === 'final' ? 'enabled' : 'disabled'}`}>
                                {doc.status === 'final' ? '확정' : '초안'}
                              </span>
                            </div>
                            {worklog ? <WorklogCard payload={worklog} variant="report" /> : <pre>{doc.content}</pre>}
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
