import { useEffect, useState } from 'react';
import { fetchEvents, fetchProjects } from '../api';
import type { Project, TimelineEvent } from '../types';

interface ProjectStat {
  projectId: string;
  projectName: string;
  workMs: number;
  commits: number;
  aiQuestions: number;
  files: number;
  errors: number;
}

function isErrorEvent(event: TimelineEvent): boolean {
  return event.type === 'error' || event.source === 'log';
}

function filePath(event: TimelineEvent): string | null {
  return (
    (event.correlationHints?.filePath as string | undefined) ??
    ((event.payload as { filePath?: string } | undefined)?.filePath) ??
    null
  );
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes}분` : `${hours}시간 ${minutes}분`;
}

async function computeStat(project: Project): Promise<ProjectStat> {
  const events = await fetchEvents(project.id);
  const files = new Set<string>();
  let workMs = 0;
  let commits = 0;
  let aiQuestions = 0;
  let errors = 0;

  for (const event of events) {
    const fp = filePath(event);
    if (fp) {
      files.add(fp);
    }
    const durationMs = (event.payload as { durationMs?: number } | undefined)?.durationMs;
    if (event.source === 'ide' && typeof durationMs === 'number') {
      workMs += durationMs;
    }
    if (event.source === 'git' && event.type === 'commit') {
      commits += 1;
    }
    if (event.source === 'ai-chat' && event.type === 'chat_exchange') {
      aiQuestions += 1;
    }
    if (isErrorEvent(event)) {
      errors += 1;
    }
  }

  return { projectId: project.id, projectName: project.name, workMs, commits, aiQuestions, files: files.size, errors };
}

interface MetricDef {
  key: string;
  label: string;
  value: (s: ProjectStat) => number;
  format: (n: number) => string;
}

const METRICS: MetricDef[] = [
  { key: 'work', label: '작업시간', value: (s) => s.workMs, format: (n) => (n > 0 ? formatDuration(n) : '0분') },
  { key: 'commits', label: '커밋 수', value: (s) => s.commits, format: (n) => `${n}회` },
  { key: 'ai', label: 'AI 질문 수', value: (s) => s.aiQuestions, format: (n) => `${n}건` },
  { key: 'files', label: '수정 파일 수', value: (s) => s.files, format: (n) => `${n}개` },
  { key: 'errors', label: '에러 수', value: (s) => s.errors, format: (n) => `${n}건` },
];

export function ProjectStats() {
  const [stats, setStats] = useState<ProjectStat[] | null>(null);

  useEffect(() => {
    setStats(null);
    fetchProjects()
      .then((projects) => Promise.all(projects.map(computeStat)))
      .then(setStats)
      .catch(() => setStats([]));
  }, []);

  return (
    <section className="panel">
      <h2>프로젝트 통계</h2>
      {!stats ? (
        <p className="empty">통계를 불러오는 중...</p>
      ) : stats.length === 0 ? (
        <p className="empty">등록된 프로젝트가 없습니다.</p>
      ) : (
        <div className="project-stats-grid">
          {METRICS.map((metric) => {
            const max = Math.max(1, ...stats.map(metric.value));
            return (
              <div key={metric.key} className="stat-block">
                <div className="stat-block-label">{metric.label}</div>
                {stats.map((stat) => {
                  const value = metric.value(stat);
                  const pct = Math.round((value / max) * 100);
                  return (
                    <div key={stat.projectId} className="stat-bar-row">
                      <span className="stat-bar-name" title={stat.projectName}>
                        {stat.projectName}
                      </span>
                      <div className="stat-bar-track">
                        <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="stat-bar-value">{metric.format(value)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
