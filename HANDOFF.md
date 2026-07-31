# DevLog AI — 작업 인수인계 (Handoff)

_최종 갱신: 2026-07-31_

## 프로젝트 개요
**DevLog AI**: 로컬 우선(local-first) 개발자 활동 추적기. Git/IDE/AI-chat 이벤트를 자동 수집해
Timeline에 쌓고, 이를 Session으로 상관(correlate)한 뒤, LLM으로 업무일지·기간 보고서·트러블슈팅 지식을 생성한다.
"오늘 해야 할 일"에서는 이 기록들을 근거로 한 할 일 추천도 제공한다.

## 기술 스택
- **백엔드**: NestJS + Prisma ORM + SQLite (`prisma/dev.db`). Event Store는 append-only.
  Json 타입은 SQLite 미지원이라 직렬화된 String 컬럼으로 저장.
- **프론트엔드**: Vite + React + TypeScript. UI 라이브러리 없이 직접 작성한 CSS
  (`web/src/styles.css`, CSS 변수 기반 테마). 다크(차콜)/라이트(크림) + 코랄(`#d97757`) 악센트.
- **LLM**: Anthropic Messages API에 raw `fetch`로 직접 호출 (`src/llm/llm-gateway.service.ts`),
  SDK 의존성 없음. `.env`의 `ANTHROPIC_API_KEY`로 실제 키 설정되어 있음 (커밋 금지, `.gitignore`에 이미 포함됨).
  모델은 `claude-haiku-4-5-20251001` 사용 (업무일지/보고서/Knowledge 등 narrative 생성 전용 —
  "오늘의 TODO" AI 추천은 LLM 미사용, 순수 규칙 기반 DB 조회).

## Git 저장소 상태
- 원격 저장소: `https://github.com/vkfkd420/DevLog-AI.git` (branch `main`), push 완료 상태 유지 중
- 최신 커밋: `43b4fa6` (대시보드 오늘의 TODO 기능 + 요약/인사이트 카드 지표 개선)

## 백엔드 모듈 (`src/`)
- `prisma/` — PrismaService (`@Global()`)
- `workspace/`, `projects/` — Workspace/Project CRUD, 프로젝트 quick-register(등록+커넥터+초기 동기화 한번에)
- `collectors/git`, `collectors/ide`, `collectors/ai-chat` — 3종 Collector (git-collector는 본인 커밋만 수집하도록 author 필터 적용됨)
- `connectors/`, `plugins/` — Connector 등록/조회, Plugin Registry
- `timeline/` — Event 조회 API
- `scheduler/` — `auto-sync`(주기적 git-collector 동기화 + 세션 재계산), `daily-worklog`(설정된 요일/시각에 업무일지 초안 자동 생성)
- `settings/` — 자동 업무일지 초안 생성 설정(요일 + 시각) CRUD
- `documents/` — Document(업무일지) CRUD/편집/확정/버전관리, 하위에 `worklog/`(일일 업무일지 생성), `report/`(기간 보고서 생성 — 프로젝트별 요약)
- `knowledge/` — 트러블슈팅 지식 자동 축적 (AI 대화 이벤트 기점으로 관련 이벤트 모아 LLM에 구조화 JSON 생성 요청)
- `search/` — Event/Document/KnowledgeEntry 통합 검색
- `todos/` — Todo CRUD + `RecommendationService`(세션 이어하기/미완료 할일/업무일지 초안 3종 추천, 매번 새로 계산·저장 안 함)

## 프론트엔드 컴포넌트 (`web/src/components/`)
- `TodayTodoCard` — 대시보드 최상단. 내가 등록한 TODO(체크박스/우선순위/마감일) + AI 추천 할 일("오늘 할 일 추가" 클릭 시에만 실제 생성)
- `SummaryCards` — 연속 활동일(스트릭), 수정 파일 수, Git Commit 수, 작업 세션 수, 해결한 에러 수, 생성된 업무일지 수
- `ActivityHeatmap` — GitHub 스타일 18주 히트맵
- `InsightCards` — 가장 많이 수정한 파일, 평균 파일 수/커밋, 가장 빈번한 에러, 가장 활발한 요일, 가장 생산적인 시간대 (규칙 기반, LLM 미사용)
- `TimelinePanel` — Session 단위로 묶어서 표시, 월별 탐색(이전/다음 + 날짜 피커), 10개씩 더보기
- `CalendarPanel` — 달력 뷰, 날짜별 업무일지 생성/열람/삭제/재생성, 연속 기록일 스트릭
- `DocumentPanel` / `AllProjectsWorklogList` — 프로젝트별 업무일지 패널 / 전체 프로젝트 통합 읽기 전용 목록
- `ReportPanel` — 기간 보고서 생성, 프로젝트별 요약, 그룹 관리, 프로젝트 선택
- `KnowledgePanel`, `SearchPanel` — Knowledge 위키, 통합 검색
- `ProjectsPanel`, `ConnectorsPanel`, `SettingsPanel` — 프로젝트 관리, 커넥터 관리, 자동 업무일지 초안 설정(요일+시각)
- 모바일 대응 반응형 네비게이션 드로어 포함

## "전체(전 프로젝트)" 보기 패턴
- 프로젝트 선택 콤보박스에 "전체" 옵션 존재 — 선택 시 `projectId`를 `undefined`로 넘겨 여러 컴포넌트가 전체 프로젝트 데이터를 합쳐서 보여줌
  (`SummaryCards`, `ActivityHeatmap`, `InsightCards`, `TimelinePanel`, `CalendarPanel`, `AllProjectsWorklogList`, `ReportPanel`, `TodayTodoCard`)
- 프로젝트 구분은 `web/src/projectColors.ts`의 공용 팔레트 + `.calendar-legend-dot`/`.calendar-legend-item` CSS 클래스로 표시

## 알려진 갭 / 미구현
- 에러/로그 Collector가 없어서 "해결한 에러 수", "가장 빈번한 에러" 등은 항상 0으로 표시됨 (이미 "데이터 없음" 상태로 우아하게 처리)
- 업무일지 편집(edit) UI는 raw content(JSON 문자열)를 그대로 textarea에 보여주는 방식 — 카드형 편집 UI는 없음 (범위 최소화 목적)
- "오늘의 TODO" AI 추천 중 다음 항목은 아직 미구현 (사용자가 명시적으로 나중에 별도 진행하기로 함):
  - **커밋되지 않은 변경 파일** 추천 — `GitCollectorService`에 `git status --porcelain` 체크 기능 추가 필요
  - **실패한 테스트** / **최근 에러 미해결** 추천 — 테스트 결과 Collector, 에러 Collector 자체가 없어 현재 범위에서 제외

## 작업 스타일 / 사용자 선호 (기억해둘 것)
- 왜/어디를/영향은 무엇인지 설명 후 코드 작성, 한 번에 한 기능씩, 실제 브라우저(Claude_Browser MCP 도구)로
  반드시 검증 후 보고, 사용자 승인 받고 다음 진행
- "현재 UI/디자인 유지, 불필요한 리팩토링 금지" — 매 기능 추가 시 기존 CSS 클래스 최대한 재사용
- 새 기능 설계 시 "기존 구조를 먼저 분석 → 설명 → 승인 대기 → 구현" 순서를 명시적으로 요구하는 경우가 있음 (예: TODO 기능)
- 디자인 방향: 딱딱한 다크 대시보드보다 부드럽고 편안한 느낌 선호 (웜 차콜/크림 + 코랄)
- 커밋/푸시는 사용자가 "커밋하고 푸쉬해줘"라고 명시적으로 요청할 때만 수행, 커밋 메시지는 한국어로 작성
- 브라우저로 기능을 테스트할 때는 반드시 테스트용 더미 데이터만 조작할 것 — 실제 사용자 데이터(예: 실제 업무일지 확정 버튼)는 절대 클릭하지 않는다
  (과거 세션에서 실수로 사용자의 실제 초안 업무일지를 확정 처리했던 사고가 있었음)
