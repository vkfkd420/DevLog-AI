import type { ReactNode } from 'react';
import { useState } from 'react';
import { search } from '../api';
import type { SearchResult } from '../types';

const EMPTY_RESULT: SearchResult = { commits: [], aiChats: [], files: [], worklogs: [], knowledge: [] };

function SearchSection({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  if (empty) {
    return null;
  }
  return (
    <div className="knowledge-section">
      <div className="knowledge-section-label">{title}</div>
      {children}
    </div>
  );
}

export function SearchPanel({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await search(projectId, query.trim());
      setResult(data);
      setSearched(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const totalCount =
    result.commits.length +
    result.aiChats.length +
    result.files.length +
    result.worklogs.length +
    result.knowledge.length;

  return (
    <section className="panel">
      <div className="generate-form">
        <input
          placeholder="Git, IDE, AI 대화, 업무일지, Knowledge를 한 번에 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          style={{ flex: 1 }}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {!searched ? (
        <p className="empty">검색어를 입력하고 Enter를 누르거나 검색 버튼을 클릭하세요.</p>
      ) : totalCount === 0 ? (
        <p className="empty">&quot;{query}&quot;에 대한 검색 결과가 없습니다.</p>
      ) : (
        <>
          <SearchSection title="Commit" empty={result.commits.length === 0}>
            <ul className="knowledge-related-list">
              {result.commits.map((commit) => (
                <li key={commit.id}>{commit.message}</li>
              ))}
            </ul>
          </SearchSection>

          <SearchSection title="AI 대화" empty={result.aiChats.length === 0}>
            <ul className="knowledge-related-list">
              {result.aiChats.map((chat) => (
                <li key={chat.id}>{chat.question}</li>
              ))}
            </ul>
          </SearchSection>

          <SearchSection title="관련 파일" empty={result.files.length === 0}>
            <div className="knowledge-file-tags">
              {result.files.map((file) => (
                <span key={file} className="event-project">
                  {file}
                </span>
              ))}
            </div>
          </SearchSection>

          <SearchSection title="업무일지" empty={result.worklogs.length === 0}>
            <ul className="knowledge-related-list">
              {result.worklogs.map((worklog) => (
                <li key={worklog.id}>
                  {worklog.periodStart.slice(0, 10)} — {worklog.snippet}
                </li>
              ))}
            </ul>
          </SearchSection>

          <SearchSection title="트러블슈팅" empty={result.knowledge.length === 0}>
            <ul className="knowledge-related-list">
              {result.knowledge.map((entry) => (
                <li key={entry.id}>
                  {entry.title} — {entry.snippet}
                </li>
              ))}
            </ul>
          </SearchSection>
        </>
      )}
    </section>
  );
}
