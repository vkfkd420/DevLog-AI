# DevLog AI

로컬 우선(local-first) 개발자 활동 추적기. Git 커밋, IDE 활동, AI 채팅 이벤트를 자동으로 수집해
Timeline에 쌓고, 이를 Session으로 상관(correlate)한 뒤, LLM으로 업무일지와 트러블슈팅 지식을 생성합니다.

## 기술 스택

- **백엔드**: NestJS + Prisma ORM + SQLite
- **프론트엔드**: Vite + React + TypeScript (UI 라이브러리 없이 직접 작성한 CSS)
- **LLM**: Anthropic Messages API (raw `fetch` 직접 호출, SDK 미사용)

## 주요 기능

### 데이터 수집 (Collectors)
- **Git Collector** — 로컬 git 저장소의 커밋 히스토리(해시, 작성자, 메시지, 변경 파일)를 Timeline에 기록
- **IDE Collector** — IDE에서 발생한 활동(파일 편집 등)을 이벤트로 수집
- **AI-Chat Collector** — AI와의 대화 이벤트를 수집

### Timeline & Session
- 모든 수집 이벤트를 시간순으로 쌓는 append-only Event Store
- Correlation 서비스가 이벤트를 분석해 자동으로 Session(작업 단위)으로 묶고, 관련 이벤트끼리 연결(EventLink)

### 업무일지 (Document)
- LLM이 Timeline/Session 데이터를 근거로 업무일지를 자동 생성
- 구조화된 JSON(`commits/files/aiQuestions/errors/troubleshooting/tomorrow/note`)으로 저장, 카드 UI로 렌더링
- 생성 후 편집/확정/버전 관리 지원

### Knowledge (트러블슈팅 지식)
- AI 대화 이벤트를 시작점으로 관련 이벤트를 모아 LLM에게 구조화된 지식(`title/cause/solution`) 생성 요청
- 자동 축적되는 트러블슈팅 위키, 검색 가능

### 대시보드 UI
- **오늘의 개발 요약 카드** — 6개 지표, 전일 대비/주간 평균 비교
- **Timeline** — Session 단위 펼치기, 이벤트별 아이콘/카테고리/시간/요약/프로젝트 태그
- **Activity Heatmap** — GitHub 스타일 18주 날짜별 히트맵
- **Insight 카드** — 최다 수정 파일, 최장 작업 파일, 최다 에러, AI 질문 키워드, 생산적 시간대 (규칙 기반)
- **프로젝트 통계** — 프로젝트별 지표 비교 막대그래프
- **통합 검색** — Git/IDE/AI대화/업무일지/Timeline/Knowledge 통합 검색

### API 문서
- Swagger UI 제공 (`/api`)

## 시작하기

### 백엔드
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```
`.env`에 `DATABASE_URL`, `ANTHROPIC_API_KEY`(LLM 기능 사용 시) 설정 필요.
서버는 기본적으로 `http://localhost:3000`에서 실행되며, `http://localhost:3000/api`에서 Swagger 문서를 볼 수 있습니다.

### 프론트엔드
```bash
cd web
npm install
npm run dev
```
`http://localhost:5173`에서 접속.

### 프로젝트 등록 & Git 연동 예시
```bash
# 1. 프로젝트 등록
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","rootPath":"/path/to/repo"}'

# 2. git-collector connector 등록 (projectId는 위 응답의 id)
curl -X POST http://localhost:3000/connectors \
  -H "Content-Type: application/json" \
  -d '{"pluginKey":"git-collector","projectId":"<projectId>","config":{}}'

# 3. sync 실행 (connectorId는 위 응답의 id)
curl -X POST http://localhost:3000/git-collector/<connectorId>/sync

# 4. Session 계산
curl -X POST http://localhost:3000/correlation/<projectId>/compute
```
> 한글 등 비 ASCII 경로를 curl로 넘길 때는 인코딩 깨짐을 피하기 위해 payload를 JSON 파일로 저장한 뒤
> `curl --data-binary @file.json`로 전달하는 것을 권장합니다.

## 알려진 갭 / 미구현
- 에러/로그 Collector가 없어 "해결한 에러 수" 등의 지표는 항상 0으로 표시됨
- 업무일지 편집 UI는 raw JSON을 textarea로 보여주는 방식 (카드형 편집 UI 미구현)
- 새 커밋이 생겨도 git-collector sync와 correlation compute를 수동으로 다시 호출해야 반영됨 (자동 폴링/webhook 없음)
