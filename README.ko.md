# AI Journal

Claude Code와 Codex 대화 기록을 로컬에서 탐색하고 검토하는 웹 앱입니다. `~/.claude/projects/` 또는 `~/.codex/sessions/`의 JSONL 세션 파일을 직접 읽습니다.

**언어:** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | 한국어 | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![메인 화면](public/screenshot-main.png)

## 기능

- **프로젝트 & 세션 탐색기** — 작업 디렉토리별로 그룹화된 모든 프로젝트와 사이드바의 전체 세션 기록
- **사이드바 필터** — 키워드를 입력하여 프로젝트와 세션을 실시간으로 필터링, 매칭 수 즉시 업데이트
- **대화 렌더링** — 전체 Markdown 렌더링, 구문 강조 코드 블록(Shiki), GFM 테이블 & 작업 목록
- **도구 호출 시각화** — Claude가 수행한 모든 도구 호출(Bash, 파일 읽기/쓰기 등)과 결과 표시
- **사고 블록** — Claude의 추론 과정을 접을 수 있는 형태로 표시
- **토큰 통계** — 세션별 입력 / 출력 / 캐시 토큰 수와 예상 비용
- **전체 텍스트 검색** — `⌘K`로 모든 세션에서 즉시 검색
- **Markdown / 이미지 내보내기** — 클릭 한 번으로 메시지를 Markdown 또는 스크린샷으로 복사
- **테마 전환** — 라이트 / 다크 / 시스템 테마, 설정 지속 저장
- **11개 언어 UI** — 브라우저 언어 자동 감지, 언제든지 언어 선택기로 전환 가능
- **인라인 이미지 표시** — 메시지에 포함된 이미지(base64 또는 URL)를 바로 렌더링；클릭하면 전체 화면으로 확대
- **이미지 라이트박스** — 배경 블러가 있는 전체 화면 오버레이；`Esc` 또는 배경 클릭으로 닫기
- **슬래시 명령어 표시** — `/command` 메시지를 원시 XML 대신 스타일이 적용된 칩으로 표시
- **로컬 명령어 출력** — 셸 명령어 출력 블록을 터미널 스타일 UI로 표시；상세 안내 메시지는 접기 가능
- **필터바 유지** — 필터 설정(사고, 도구, 사용자/Claude 메시지)이 세션 전환 시에도 유지
- **세션 기억** — URL 파라미터를 통해 새로 고침 후에도 마지막으로 본 세션 복원
- **공유 가능한 URL** — URL을 복사하면 정확한 세션과 스크롤 위치를 공유 (`?p=&s=&scroll=`)
- **맨 위로** — 스크롤이 많이 내려가면 부유 버튼 표시；클릭하면 맨 위로 이동
- **PWA** — 데스크탑 또는 홈 화면에 설치 가능；새 버전 배포 시 자동으로 자동 업데이트

![검색 화면](public/screenshot-search.png)

## 빠른 시작

**전제 조건:** [Claude Code](https://claude.ai/code)가 설치되어 있고 최소 한 번 사용된 상태여야 합니다(`~/.claude/projects/`가 로컬에 존재해야 함).

```bash
# 저장소 클론
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev
```

[http://localhost:3000](http://localhost:3000)을 열어 모든 Claude Code 세션을 탐색하세요.

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16 | 프레임워크 & API Routes |
| React | 19 | UI |
| Tailwind CSS | v4 | 스타일링 |
| Shiki | v4 | 코드 구문 강조 |
| react-markdown | v10 | Markdown 렌더링 |
| remark-gfm | v4 | GFM 확장 문법 |

## 데이터 소스

모든 데이터는 내 컴퓨터에 남습니다. 앱은 브라우저의 File System Access API로 세션 파일을 직접 읽으며 업로드하지 않습니다.

Claude Code:

```txt
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Codex:

```txt
~/.codex/sessions/
  └── YYYY/MM/DD/
        ├── rollout-<timestamp>-<id>.jsonl
        └── ...
```

각 `.jsonl` 파일은 하나의 세션에 해당하며 메시지 기록과 사용 가능한 토큰 사용량을 포함합니다.

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `⌘K` | 전체 텍스트 검색 열기 |
| `⌘\` | 사이드바 열기 / 닫기 |
| `Esc` | 검색 / 라이트박스 닫기 |
