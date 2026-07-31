import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { colorForProject } from '../projectColors';
import { CheckIcon, ChevronDownIcon } from '../icons';

interface ProjectSelectProps {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
  // "전체" 항목을 목록 맨 위에 추가할지 여부 (대시보드/달력 탭에서만 사용).
  allValue?: string;
  allLabel?: string;
}

// 브라우저 기본 <select>를 대체하는 커스텀 드롭다운 — 버튼에 현재 선택된 프로젝트의
// 색상 점을 보여주고, 펼치면 팝오버 리스트에서 색상 점 + 체크마크로 선택 상태를 표시한다.
export function ProjectSelect({ projects, value, onChange, allValue, allLabel = '전체' }: ProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const isAllSelected = allValue !== undefined && value === allValue;
  const selectedProject = projects.find((p) => p.id === value);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="project-select" ref={containerRef}>
      <button type="button" className="project-select-trigger" onClick={() => setOpen((o) => !o)}>
        {isAllSelected ? (
          <span className="project-select-label">{allLabel}</span>
        ) : selectedProject ? (
          <span className="project-select-label">
            <span
              className="calendar-legend-dot"
              style={{ background: colorForProject(selectedProject.id, sortedProjectIds) }}
            />
            {selectedProject.name}
          </span>
        ) : (
          <span className="project-select-label">프로젝트 선택</span>
        )}
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="project-select-menu">
          {allValue !== undefined && (
            <button
              type="button"
              className={`project-select-option${isAllSelected ? ' active' : ''}`}
              onClick={() => select(allValue)}
            >
              <span className="project-select-label">{allLabel}</span>
              {isAllSelected && <CheckIcon />}
            </button>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-select-option${value === project.id ? ' active' : ''}`}
              onClick={() => select(project.id)}
            >
              <span className="project-select-label">
                <span
                  className="calendar-legend-dot"
                  style={{ background: colorForProject(project.id, sortedProjectIds) }}
                />
                {project.name}
              </span>
              {value === project.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
