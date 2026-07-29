import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchProjects } from './api';
import type { Project } from './types';
import { TimelinePanel } from './components/TimelinePanel';
import { DocumentPanel } from './components/DocumentPanel';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { SummaryCards } from './components/SummaryCards';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { InsightCards } from './components/InsightCards';
import { ProjectStats } from './components/ProjectStats';
import { KnowledgePanel } from './components/KnowledgePanel';
import { SearchPanel } from './components/SearchPanel';
import {
  CloseIcon,
  ConnectorIcon,
  DashboardIcon,
  KnowledgeIcon,
  MenuIcon,
  MoonIcon,
  ProjectIcon,
  SearchIcon,
  SunIcon,
} from './icons';

type Tab = 'dashboard' | 'connectors' | 'projects' | 'knowledge' | 'search';
type Theme = 'dark' | 'light';

const THEME_KEY = 'devlog-ai-theme';

function getInitialTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

const NAV_ITEMS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: '대시보드', icon: <DashboardIcon /> },
  { key: 'knowledge', label: 'Knowledge', icon: <KnowledgeIcon /> },
  { key: 'search', label: 'Search', icon: <SearchIcon /> },
  { key: 'connectors', label: '커넥터', icon: <ConnectorIcon /> },
  { key: 'projects', label: '프로젝트', icon: <ProjectIcon /> },
];

// 프로젝트 선택 셀렉트가 필요한 탭 (프로젝트에 종속된 데이터를 보여주는 탭)
const PROJECT_SCOPED_TABS: Tab[] = ['dashboard', 'knowledge', 'search'];

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // 탭을 전환할 때마다 다시 불러온다 — 프로젝트 관리 화면에서 등록/archive한 결과가
  // 대시보드의 프로젝트 선택 목록에도 곧바로 반영되도록. 현재 선택은 유효하면 유지한다.
  useEffect(() => {
    fetchProjects()
      .then((data) => {
        setProjects(data);
        setSelectedProjectId((current) =>
          current && data.some((project) => project.id === current) ? current : data[0]?.id ?? '',
        );
      })
      .catch((e) => setError(String(e)));
  }, [tab]);

  const projectSelect = PROJECT_SCOPED_TABS.includes(tab) && projects.length > 0 && (
    <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">
          <MenuIcon />
        </button>
        <div className="brand">DevLog AI</div>
      </header>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">DevLog AI</div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기">
            <CloseIcon />
          </button>
        </div>
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? 'active' : ''}
              onClick={() => {
                setTab(item.key);
                setSidebarOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>
        </button>
      </aside>

      <div className="content">
        {error && (
          <p className="banner-error">백엔드 연결 실패: {error} (localhost:3000 서버가 켜져 있는지 확인하세요)</p>
        )}

        {tab === 'dashboard' && (
          <>
            <header className="page-header">
              <h1>대시보드</h1>
              {projectSelect}
            </header>
            {!error && projects.length === 0 && <p className="empty">등록된 프로젝트가 없습니다.</p>}
            {selectedProjectId && (
              <>
                <SummaryCards projectId={selectedProjectId} />
                <ActivityHeatmap projectId={selectedProjectId} />
                <InsightCards projectId={selectedProjectId} />
                <main className="app-main">
                  <TimelinePanel
                    projectId={selectedProjectId}
                    projectName={projects.find((project) => project.id === selectedProjectId)?.name ?? ''}
                    onNavigateToConnectors={() => setTab('connectors')}
                  />
                  <DocumentPanel projectId={selectedProjectId} />
                </main>
              </>
            )}
          </>
        )}

        {tab === 'knowledge' && (
          <>
            <header className="page-header">
              <h1>Knowledge</h1>
              {projectSelect}
            </header>
            {!error && projects.length === 0 && <p className="empty">등록된 프로젝트가 없습니다.</p>}
            {selectedProjectId && <KnowledgePanel projectId={selectedProjectId} />}
          </>
        )}

        {tab === 'search' && (
          <>
            <header className="page-header">
              <h1>Search</h1>
              {projectSelect}
            </header>
            {!error && projects.length === 0 && <p className="empty">등록된 프로젝트가 없습니다.</p>}
            {selectedProjectId && <SearchPanel projectId={selectedProjectId} />}
          </>
        )}

        {tab === 'connectors' && (
          <>
            <header className="page-header">
              <h1>커넥터</h1>
            </header>
            <ConnectorsPanel />
          </>
        )}

        {tab === 'projects' && (
          <>
            <header className="page-header">
              <h1>프로젝트</h1>
            </header>
            <ProjectsPanel />
            <ProjectStats />
          </>
        )}
      </div>
    </div>
  );
}
