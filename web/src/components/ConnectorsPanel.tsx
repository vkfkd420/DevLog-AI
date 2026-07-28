import { useEffect, useState } from 'react';
import {
  fetchConnectors,
  fetchPlugins,
  fetchProjects,
  registerConnector,
  syncGitConnector,
  updateConnector,
} from '../api';
import type { Connector, Plugin, Project } from '../types';

export function ConnectorsPanel() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [pluginKey, setPluginKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [config, setConfig] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => fetchConnectors().then(setConnectors);

  useEffect(() => {
    fetchPlugins().then((data) => {
      setPlugins(data);
      if (data.length > 0) {
        setPluginKey(data[0].key);
      }
    });
    fetchProjects().then(setProjects);
    reload();
  }, []);

  const projectName = (id: string | null): string => {
    if (!id) return '전역';
    return projects.find((project) => project.id === id)?.name ?? id;
  };

  const handleRegister = async () => {
    setError(null);
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = config.trim() ? JSON.parse(config) : {};
    } catch {
      setError('config는 올바른 JSON이어야 합니다.');
      return;
    }
    try {
      await registerConnector(pluginKey, projectId || undefined, parsedConfig);
      setConfig('{}');
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleToggleStatus = async (connector: Connector) => {
    setBusyId(connector.id);
    setError(null);
    try {
      await updateConnector(connector.id, {
        status: connector.status === 'enabled' ? 'disabled' : 'enabled',
      });
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleSync = async (connector: Connector) => {
    setBusyId(connector.id);
    setError(null);
    try {
      await syncGitConnector(connector.id);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel">
      <h2>Connector 등록</h2>
      <div className="connector-form">
        <select value={pluginKey} onChange={(e) => setPluginKey(e.target.value)}>
          {plugins.map((plugin) => (
            <option key={plugin.key} value={plugin.key}>
              {plugin.name}
            </option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">전역 (프로젝트 없음)</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <input
          className="config-input"
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          placeholder="config (JSON)"
        />
        <button onClick={handleRegister}>등록</button>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>등록된 Connector</h2>
      {connectors.length === 0 ? (
        <p className="empty">등록된 Connector가 없습니다.</p>
      ) : (
        <table className="connector-table">
          <thead>
            <tr>
              <th>Plugin</th>
              <th>Project</th>
              <th>Status</th>
              <th>최근 오류</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {connectors.map((connector) => (
              <tr key={connector.id}>
                <td>{connector.pluginKey}</td>
                <td>{projectName(connector.projectId)}</td>
                <td>
                  <span className={`status-badge ${connector.status}`}>{connector.status}</span>
                </td>
                <td className="error-cell" title={connector.lastError ?? ''}>
                  {connector.lastError ?? '-'}
                </td>
                <td className="actions-cell">
                  <button disabled={busyId === connector.id} onClick={() => handleToggleStatus(connector)}>
                    {connector.status === 'enabled' ? '비활성화' : '활성화'}
                  </button>
                  {connector.pluginKey === 'git-collector' && (
                    <button disabled={busyId === connector.id} onClick={() => handleSync(connector)}>
                      동기화
                    </button>
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
