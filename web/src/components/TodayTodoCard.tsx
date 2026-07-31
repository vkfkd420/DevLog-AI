import { useEffect, useState } from 'react';
import { createTodo, deleteTodo, fetchTodoRecommendations, fetchTodos, updateTodo } from '../api';
import { colorForProject } from '../projectColors';
import type { Project, Todo, TodoRecommendation } from '../types';

const PRIORITY_ORDER: Record<Todo['priority'], number> = { high: 0, normal: 1, low: 2 };
const PRIORITY_LABEL: Record<Todo['priority'], string> = { high: '높음', normal: '보통', low: '낮음' };

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.priority !== b.priority) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    const aDue = a.dueDate ?? '';
    const bDue = b.dueDate ?? '';
    if (aDue !== bDue) {
      if (!aDue) return 1;
      if (!bDue) return -1;
      return aDue.localeCompare(bDue);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return dueDate.slice(5, 10).replace('-', '/');
}

export function TodayTodoCard({ projectId, projects }: { projectId?: string; projects: Project[] }) {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [recommendations, setRecommendations] = useState<TodoRecommendation[] | null>(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Todo['priority']>('normal');
  const [dueDate, setDueDate] = useState('');
  const [quickAddProjectId, setQuickAddProjectId] = useState(projectId ?? projects[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  const isAllProjects = projectId === undefined;
  const sortedProjectIds = [...projects].map((p) => p.id).sort();
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '알 수 없는 프로젝트';

  const reload = () => {
    fetchTodos(projectId)
      .then(setTodos)
      .catch(() => setTodos([]));
    fetchTodoRecommendations(projectId)
      .then(setRecommendations)
      .catch(() => setRecommendations([]));
  };

  useEffect(() => {
    setTodos(null);
    setRecommendations(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setQuickAddProjectId(projectId ?? projects[0]?.id ?? '');
  }, [projectId, projects]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !quickAddProjectId) return;
    setSubmitting(true);
    try {
      await createTodo({
        projectId: quickAddProjectId,
        title: title.trim(),
        priority,
        dueDate: dueDate || undefined,
      });
      setTitle('');
      setPriority('normal');
      setDueDate('');
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed });
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    reload();
  };

  const handleAcceptRecommendation = async (rec: TodoRecommendation) => {
    await createTodo({
      projectId: rec.projectId,
      title: rec.message,
      source: 'ai_suggested',
      sessionId: rec.sessionId,
      documentId: rec.documentId,
    });
    reload();
  };

  const sorted = todos ? sortTodos(todos) : [];

  return (
    <div className="todo-card-group">
      <div className="todo-section">
        <div className="todo-section-header">
          <h3>내가 등록한 TODO</h3>
        </div>

        <form className="todo-quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="할 일을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {isAllProjects && (
            <select value={quickAddProjectId} onChange={(e) => setQuickAddProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <select value={priority} onChange={(e) => setPriority(e.target.value as Todo['priority'])}>
            <option value="high">높음</option>
            <option value="normal">보통</option>
            <option value="low">낮음</option>
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={submitting || !title.trim()}>
            추가
          </button>
        </form>

        {todos === null && <p className="empty">할 일을 불러오는 중...</p>}
        {todos !== null && sorted.length === 0 && <p className="empty">등록된 할 일이 없습니다.</p>}
        {todos !== null && sorted.length > 0 && (
          <ul className="todo-list">
            {sorted.map((todo) => (
              <li key={todo.id} className={`todo-item${todo.completed ? ' todo-item-done' : ''}`}>
                <label className="todo-item-main">
                  <input type="checkbox" checked={todo.completed} onChange={() => handleToggle(todo)} />
                  <span className="todo-item-title">{todo.title}</span>
                </label>
                <div className="todo-item-meta">
                  {isAllProjects && (
                    <span className="calendar-legend-item">
                      <span
                        className="calendar-legend-dot"
                        style={{ background: colorForProject(todo.projectId, sortedProjectIds) }}
                      />
                      {projectName(todo.projectId)}
                    </span>
                  )}
                  <span className={`todo-priority-tag todo-priority-${todo.priority}`}>
                    {PRIORITY_LABEL[todo.priority]}
                  </span>
                  {formatDueDate(todo.dueDate) && <span className="todo-due-tag">{formatDueDate(todo.dueDate)}</span>}
                  <button className="btn-secondary" onClick={() => handleDelete(todo.id)}>
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="todo-section">
        <div className="todo-section-header">
          <h3>AI 추천 할 일</h3>
        </div>
        {recommendations === null && <p className="empty">추천을 분석하는 중...</p>}
        {recommendations !== null && recommendations.length === 0 && (
          <p className="empty">지금은 추천할 항목이 없습니다.</p>
        )}
        {recommendations !== null && recommendations.length > 0 && (
          <ul className="todo-recommend-list">
            {recommendations.map((rec) => (
              <li key={rec.key} className="todo-recommend-item">
                <div className="todo-recommend-text">
                  {isAllProjects && (
                    <span className="calendar-legend-item">
                      <span
                        className="calendar-legend-dot"
                        style={{ background: colorForProject(rec.projectId, sortedProjectIds) }}
                      />
                      {projectName(rec.projectId)}
                    </span>
                  )}
                  <span>{rec.message}</span>
                </div>
                <button className="btn-secondary" onClick={() => handleAcceptRecommendation(rec)}>
                  오늘 할 일 추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
