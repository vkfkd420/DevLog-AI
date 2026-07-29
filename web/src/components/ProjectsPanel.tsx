import { useEffect, useState } from 'react';
import { deleteProject, fetchProjects, quickRegisterProject, updateProject } from '../api';
import type { Project, QuickRegisterResult } from '../types';

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

  const reload = () => fetchProjects(showArchived).then(setProjects);

  useEffect(() => {
    reload();
  }, [showArchived]);

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
    <section className="panel">
      <h2>Project 등록</h2>
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
                        <button className="btn-danger" disabled={busyId === project.id} onClick={() => handleDelete(project)}>
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
  );
}
