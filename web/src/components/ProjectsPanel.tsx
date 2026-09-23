import { useEffect, useState } from 'react';
import { deleteProject, discoverProjects, fetchProjects, quickRegisterProject, updateProject } from '../api';
import type { DiscoveredProject, Project, QuickRegisterResult } from '../types';
import { CheckIcon } from '../icons';

// "C:/a/b/c" -> "C:/a/b" — 기존 프로젝트가 모여있는 폴더를 추정해 찾기 입력의 기본값으로 쓴다.
function parentDir(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<QuickRegisterResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [discoverRoot, setDiscoverRoot] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredProject[] | null>(null);
  const [discoverFilter, setDiscoverFilter] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const reload = () => fetchProjects(showArchived).then(setProjects);

  useEffect(() => {
    reload();
  }, [showArchived]);

  // 기존 프로젝트가 있으면 그게 모여있는 폴더를 기본값으로 채워둬서, 보통은 "찾기"만 누르면 되게 한다.
  useEffect(() => {
    if (!discoverRoot && projects.length > 0) {
      setDiscoverRoot(parentDir(projects[0].rootPath));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const handleRegister = async () => {
    setError(null);
    setRegisterResult(null);
    if (!name.trim() || !rootPath.trim()) {
      setError('name과 rootPath는 필수입니다.');
      return;
    }
    setRegistering(true);
    try {
      const result = await quickRegisterProject(name.trim(), rootPath.trim());
      setRegisterResult(result);
      setName('');
      setRootPath('');
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setRegistering(false);
    }
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscoverError(null);
    setDiscovered(null);
    setDiscoverFilter('');
    setSelectedPaths(new Set());
    if (!discoverRoot.trim()) {
      setDiscoverError('찾아볼 상위 폴더 경로를 입력하세요.');
      return;
    }
    setDiscovering(true);
    try {
      const found = await discoverProjects(discoverRoot.trim());
      setDiscovered(found);
    } catch (e) {
      setDiscoverError(String(e));
    } finally {
      setDiscovering(false);
    }
  };

  const toggleSelected = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const filteredDiscovered = (discovered ?? []).filter((d) => {
    const q = discoverFilter.trim().toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.path.toLowerCase().includes(q);
  });

  const allDiscoveredSelected =
    filteredDiscovered.length > 0 && filteredDiscovered.every((d) => selectedPaths.has(d.path));

  const toggleSelectAll = () => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (allDiscoveredSelected) {
        filteredDiscovered.forEach((d) => next.delete(d.path));
      } else {
        filteredDiscovered.forEach((d) => next.add(d.path));
      }
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (!discovered || selectedPaths.size === 0) return;
    setImporting(true);
    setDiscoverError(null);
    try {
      const targets = discovered.filter((d) => selectedPaths.has(d.path));
      for (const target of targets) {
        await quickRegisterProject(target.name, target.path);
      }
      setDiscovered((prev) => prev?.filter((d) => !selectedPaths.has(d.path)) ?? null);
      setSelectedPaths(new Set());
      await reload();
    } catch (e) {
      setDiscoverError(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleToggleArchive = async (project: Project) => {
    setBusyId(project.id);
    setError(null);
    try {
      await updateProject(project.id, { archived: !project.archivedAt });
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `"${project.name}" 프로젝트를 완전히 삭제할까요?\n관련된 모든 이벤트/세션/업무일지/Knowledge/커넥터가 함께 삭제되며 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;
    setBusyId(project.id);
    setError(null);
    try {
      await deleteProject(project.id);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusyId(editingId);
    setError(null);
    try {
      await updateProject(editingId, { name: editingName.trim() });
      await reload();
      cancelEdit();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>폴더에서 찾기</h2>
        <p className="empty">
          여러 프로젝트가 모여있는 상위 폴더를 지정하면, 그 안(최대 2단계)에서 git 저장소를 찾아
          후보로 보여줍니다. 원하는 것만 골라서 등록하세요.
        </p>
        <form className="connector-form" onSubmit={handleDiscover}>
          <input
            className="config-input"
            placeholder="상위 폴더 (예: C:/workspace/개인용)"
            value={discoverRoot}
            onChange={(e) => setDiscoverRoot(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={discovering}>
            {discovering ? '찾는 중...' : '찾기'}
          </button>
        </form>
        {discoverError && <p className="error">{discoverError}</p>}

        {discovered && (
          <>
            {discovered.length === 0 ? (
              <p className="empty">새로 찾은 git 저장소가 없습니다 (이미 등록된 것은 제외됩니다).</p>
            ) : (
              <>
                {discovered.length > 8 && (
                  <input
                    className="discover-search"
                    placeholder="이름으로 필터링..."
                    value={discoverFilter}
                    onChange={(e) => setDiscoverFilter(e.target.value)}
                  />
                )}
                <div className="panel-toolbar">
                  <span className="empty">
                    {discovered.length}개 발견
                    {discoverFilter.trim() && ` · ${filteredDiscovered.length}개 필터링됨`} · {selectedPaths.size}개
                    선택됨
                  </span>
                  <button className="link" type="button" onClick={toggleSelectAll}>
                    {allDiscoveredSelected ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="discover-list-scroll">
                  <ul className="discover-list">
                    {filteredDiscovered.map((d) => {
                      const selected = selectedPaths.has(d.path);
                      return (
                        <li key={d.path}>
                          <button
                            type="button"
                            className={`discover-card${selected ? ' selected' : ''}`}
                            onClick={() => toggleSelected(d.path)}
                          >
                            <span className="discover-card-check">{selected && <CheckIcon />}</span>
                            <span className="discover-card-info">
                              <span className="discover-card-name">{d.name}</span>
                              <span className="discover-card-path" title={d.path}>
                                {d.path}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {filteredDiscovered.length === 0 && <p className="empty">필터와 일치하는 항목이 없습니다.</p>}
                </div>
                {selectedPaths.size > 0 && (
                  <button className="btn-primary" onClick={handleImportSelected} disabled={importing}>
                    {importing ? '등록 중...' : `선택한 ${selectedPaths.size}개 등록`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="panel">
        {!showManualForm ? (
          <button type="button" className="link" onClick={() => setShowManualForm(true)}>
            직접 경로를 입력해서 등록하기
          </button>
        ) : (
          <>
            <div className="panel-toolbar">
              <h2>직접 입력으로 등록</h2>
              <button type="button" className="link" onClick={() => setShowManualForm(false)}>
                접기
              </button>
            </div>
            <p className="empty">이름과 로컬 git 경로만 입력하면 커밋 수집 연결과 초기 동기화까지 한 번에 처리됩니다.</p>
            <div className="connector-form">
              <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
              <input
                className="config-input"
                placeholder="rootPath (예: C:/workspace/my-project)"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
              />
              <button onClick={handleRegister} disabled={registering}>
                {registering ? '등록 중...' : '등록'}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            {registerResult && (
              <p className="empty">
                "{registerResult.project.name}" 등록 완료 —{' '}
                {registerResult.syncError
                  ? `초기 동기화 실패 (${registerResult.syncError}). 커넥터 탭에서 나중에 다시 시도할 수 있습니다.`
                  : `커밋 ${registerResult.scannedCommits}개 동기화, 세션 ${registerResult.sessionsCreated}개 생성됨.`}
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-toolbar">
          <h2>등록된 Project</h2>
          <label className="checkbox-label">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            비활성화 포함 보기
          </label>
        </div>

        {projects.length === 0 ? (
          <p className="empty">등록된 Project가 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="connector-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>rootPath</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      {editingId === project.id ? (
                        <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                      ) : (
                        project.name
                      )}
                    </td>
                    <td className="path-cell" title={project.rootPath}>
                      {project.rootPath}
                    </td>
                    <td>
                      <span className={`status-badge ${project.archivedAt ? 'disabled' : 'enabled'}`}>
                        {project.archivedAt ? '비활성화됨' : '활성'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {editingId === project.id ? (
                        <>
                          <button disabled={busyId === project.id} onClick={saveEdit}>
                            저장
                          </button>
                          <button onClick={cancelEdit}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(project)}>이름변경</button>
                          <button disabled={busyId === project.id} onClick={() => handleToggleArchive(project)}>
                            {project.archivedAt ? '복구' : '비활성화'}
                          </button>
                          <button
                            className="btn-danger"
                            disabled={busyId === project.id}
                            onClick={() => handleDelete(project)}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
