# DevLog AI — 작업 인수인계 (Handoff)

## 프로젝트 개요
**DevLog AI**: 로컬 우선(local-first) 개발자 활동 추적기. Git/IDE/AI-chat 이벤트를 자동 수집해
Timeline에 쌓고, 이를 Session으로 상관(correlate)한 뒤, LLM으로 업무일지·트러블슈팅 지식을 생성한다.

## 기술 스택
- **백엔드**: NestJS + Prisma ORM + SQLite (`prisma/dev.db`). Event Store는 append-only.
  Json 타입은 SQLite 미지원이라 직렬화된 String 컬럼으로 저장.
- **프론트엔드**: Vite + React + TypeScript. UI 라이브러리 없이 직접 작성한 CSS
  (`web/src/styles.css`, CSS 변수 기반 테마). 다크(차콜)/라이트(크림) + 코랄(`#d97757`) 악센트.
- **LLM**: Anthropic Messages API에 raw `fetch`로 직접 호출 (`src/llm/llm-gateway.service.ts`),
  SDK 의존성 없음. `.env`의 `ANTHROPIC_API_KEY`로 실제 키 설정되어 있음 (커밋 금지, `.gitignore`에 이미 포함됨).

## 완료된 작업

### 백엔드 MVP 파이프라인 (전부 완료)
- Prisma 기반 Event Store, Plugin Registry, Connector 등록/조회
- Workspace/Project CRUD
- Git / IDE / AI-Chat Collector 3종
- Correlation 서비스 (Session 생성, EventLink로 이벤트 연결, 세션 조회 API)
- LLM Gateway + Document(업무일지) 생성/편집/확정/버전관리
- Knowledge(트러블슈팅 지식) 모듈 — AI 대화 이벤트를 시작점으로 관련 이벤트를 모아 LLM에게
  구조화된 JSON(`title/cause/solution`)으로 생성 요청
- Search 모듈 — Event/Document/KnowledgeEntry 통합 검색
- Swagger UI 문서화

### 프론트엔드 — UI/UX 10개 항목 (전부 완료)
사용자가 순차 승인하며 진행한 10개 기능 목록, 전부 구현+브라우저 검증 완료:

1. **오늘의 개발 요약 카드** (`SummaryCards.tsx`) — 6개 지표, 전일 대비/주간 평균 비교
2. **Session 기능** (Timeline 내) — Session #N, 시간범위, 이벤트/커밋/AI질문/에러 카운트, 펼치기
3. **Timeline 개선** — 이벤트별 아이콘/카테고리/시간/요약/프로젝트 태그
4. **Knowledge 메뉴** — 자동 축적 트러블슈팅 위키, 검색 가능
5. **Search 메뉴** — Git/IDE/AI대화/업무일지/Timeline/Knowledge 통합 검색
6. **Activity Heatmap** (`ActivityHeatmap.tsx`) — GitHub 스타일 18주 날짜별 히트맵, CSS만 사용
7. **Insight 카드** (`InsightCards.tsx`) — 최다 수정 파일/최장 작업 파일/최다 에러/AI 질문 키워드/생산적 시간대 (규칙 기반, LLM 미사용)
8. **프로젝트 통계** (`ProjectStats.tsx`) — 프로젝트별 5개 지표를 CSS 막대그래프로 비교
9. **업무일지 카드 UI** — `content`를 구조화 JSON(`commits/files/aiQuestions/errors/troubleshooting/tomorrow/note`)으로 저장,
   프론트에서 JSON 파싱 성공 시 카드로, 실패(기존 마크다운) 시 `<pre>`로 하위호환 렌더링
10. **UX 원칙** — 애니메이션 최소화, 정보 밀도 높지만 복잡하지 않게 (Cursor/GitHub Desktop/Notion/Raycast/Linear 참고), 지속 적용 원칙

## Git 저장소 상태 (⚠️ 다음 세션에서 바로 확인 필요)
- `git init` 완료, 첫 커밋 완료: `bd47e3d "Initial commit: DevLog AI MVP"` (branch `main`)
- 원격 저장소 연결됨: `https://github.com/vkfkd420/DevLog-AI.git`
- **push는 아직 안 됨** — auto-mode 안전 분류기가 `git push`를 차단해서 사용자가 직접 실행해야 함:
  ```
  git push -u origin main
  ```
- `.gitignore`에 `node_modules/`, `dist/`, `*.db`, `*.db-journal`, `.env` 포함되어 정상 제외됨 확인 완료

## 폴더명 변경 (✅ 완료)
- `C:\workspace\개인용\memoir` → `C:\workspace\개인용\DevLog-AI` rename 완료됨 (사용자가 세션 밖에서 직접 처리)
- 소스 코드/설정 파일 내 "memoir" 하드코딩 없음을 확인함 (`grep -ri memoir` 결과 HANDOFF.md 자체 언급 외 없음)

## 테스트 데이터 정리 + 실제 프로젝트 연결 (✅ 완료, 2026-07-29)
- DB에 있던 테스트 프로젝트 전부 삭제: `DevLog AI (renamed)`, `Git Collector Test`, `UI 테스트 프로젝트 (수정됨)`,
  그리고 추가로 발견된 archived 테스트 프로젝트 `bad`(rootPath `C:/no/such/repo`)와 연결 안 된 테스트 Connector 5개
  (관련 Event/EventLink/Document/KnowledgeEntry 포함 전부 정리)
  — 정리에 쓴 스크립트는 일회성이라 실행 후 삭제함 (repo에 남아있지 않음)
- 실제 프로젝트로 이 저장소 자체(`DevLog AI`, rootPath `C:/workspace/개인용/DevLog-AI`)를 등록함
  (프로젝트 id `cms5b6nu10003voqs1v7gipci`)
  - ⚠️ curl로 한글 경로를 직접 넘기면 Windows 콘솔 인코딩 때문에 rootPath가 깨짐 — JSON을 파일로 먼저 쓰고
    `curl --data-binary @file`로 넘겨야 안전함
- git-collector connector 등록 + sync 완료 (`cms5b6szu0005voqsobn8sw60`), 실제 커밋(`Initial commit: DevLog AI MVP`) 1건 수집,
  correlation 실행으로 Session #1 생성 확인, 프론트엔드(`localhost:5173`)에서 실제 데이터로 렌더링되는 것까지 브라우저로 검증 완료
- 이전에 있던 `"spawn git ENOENT"` 에러는 git PATH 문제가 아니라 테스트 프로젝트의 rootPath가 존재하지 않는 경로(`C:/no/such/repo`)였기 때문 — 실제 프로젝트에서는 재현 안 됨, 이슈 해소됨

## 알려진 갭 / 미구현
- 에러/로그 Collector가 없어서 "해결한 에러 수", "가장 빈번한 에러" 등은 항상 0으로 표시됨
  (Insight 카드 등에서 이미 "데이터 없음" 상태로 우아하게 처리해둠)
- 업무일지 편집(edit) UI는 여전히 raw content(이제는 JSON 문자열)를 그대로 textarea에 보여주는 방식 —
  카드형 편집 UI는 별도로 만들지 않음 (범위 최소화 목적)

## 작업 스타일 / 사용자 선호 (기억해둘 것)
- 왜/어디를/영향은 무엇인지 설명 후 코드 작성, 한 번에 한 기능씩, 실제 브라우저(Claude_Browser MCP 도구)로
  반드시 검증 후 보고, 사용자 승인 받고 다음 진행
- "현재 UI/디자인 유지, 불필요한 리팩토링 금지" — 매 기능 추가 시 기존 CSS 클래스 최대한 재사용
  (예: Search가 Knowledge의 `.knowledge-section` 클래스 재사용)
- 디자인 방향: 딱딱한 다크 대시보드보다 부드럽고 편안한 느낌 선호 (그래서 웜 차콜/크림 + 코랄로 확정)
