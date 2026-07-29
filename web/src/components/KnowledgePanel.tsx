import { useEffect, useState } from 'react';
import { fetchKnowledgeEntries, fetchKnowledgeEntry } from '../api';
import type { KnowledgeEntryDetail, KnowledgeEntrySummary } from '../types';

export function KnowledgePanel({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<KnowledgeEntrySummary[]>([]);
  const [selected, setSelected] = useState<KnowledgeEntryDetail | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelected(null);
    setError(null);
    setLoading(true);
    fetchKnowledgeEntries(projectId)
      .then(setEntries)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSelect = (id: string) => {
    fetchKnowledgeEntry(id).then(setSelected).catch((e) => setError(String(e)));
  };

  const filtered = entries.filter((entry) => entry.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`knowledge-layout${selected ? '' : ' single-column'}`}>
      <section className="panel">
        <h2>Knowledge</h2>
        <input
          className="knowledge-search"
          placeholder="검색 (제목)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="empty">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="empty">
            {entries.length === 0
              ? 'Timeline의 AI 대화 이벤트에서 "Knowledge로 만들기"를 누르면 여기에 쌓입니다.'
              : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <ul className="document-list">
            {filtered.map((entry) => (
              <li key={entry.id}>
                <button className="link" onClick={() => handleSelect(entry.id)}>
                  <span>{entry.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="panel">
          <h2>{selected.title}</h2>

          <div className="knowledge-section">
            <div className="knowledge-section-label">원인</div>
            <p>{selected.cause ?? '기록되지 않았습니다.'}</p>
          </div>

          <div className="knowledge-section">
            <div className="knowledge-section-label">해결방법</div>
            <p>{selected.solution ?? '기록되지 않았습니다.'}</p>
          </div>

          <div className="knowledge-section">
            <div className="knowledge-section-label">관련 Commit</div>
            {selected.commits.length === 0 ? (
              <p className="empty">없음</p>
            ) : (
              <ul className="knowledge-related-list">
                {selected.commits.map((commit) => (
                  <li key={commit.id}>{commit.message}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="knowledge-section">
            <div className="knowledge-section-label">관련 AI 대화</div>
            {selected.aiChats.length === 0 ? (
              <p className="empty">없음</p>
            ) : (
              <ul className="knowledge-related-list">
                {selected.aiChats.map((chat) => (
                  <li key={chat.id}>{chat.question}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="knowledge-section">
            <div className="knowledge-section-label">관련 파일</div>
            {selected.files.length === 0 ? (
              <p className="empty">없음</p>
            ) : (
              <div className="knowledge-file-tags">
                {selected.files.map((file) => (
                  <span key={file} className="event-project">
                    {file}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="knowledge-section">
            <div className="knowledge-section-label">관련 업무일지</div>
            {selected.worklogs.length === 0 ? (
              <p className="empty">없음</p>
            ) : (
              <ul className="knowledge-related-list">
                {selected.worklogs.map((worklog) => (
                  <li key={worklog.id}>{worklog.periodStart.slice(0, 10)}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
