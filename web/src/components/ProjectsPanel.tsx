import { useEffect, useState } from 'react';
import { fetchProjects, registerProject, updateProject } from '../api';
import type { Project } from '../types';

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    if (!name.trim() || !rootPath.trim()) {
      setError('name과 rootPath는 필수입니다.');
      return;
    }
    try {
      await registerProject(name.trim(), rootPath.trim());
      setName('');
      setRootPath('');
      await reload();
    } catch (e) {
      setError(String(e));
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
      <div className="connector-form">
        <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="config-input"
          placeholder="rootPath (예: C:/workspace/my-project)"
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
        />
        <button onClick={handleRegister}>등록</button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="panel-toolbar">
        <h2>등록된 Project</h2>
        <label className="checkbox-label">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          archive 포함 보기
        </label>
      </div>

      {projects.length === 0 ? (
        <p className="empty">등록된 Project가 없습니다.</p>
      ) : (
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
                    {project.archivedAt ? 'archived' : 'active'}
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
                        {project.archivedAt ? '복구' : 'archive'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
