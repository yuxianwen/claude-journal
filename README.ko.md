# Claude Journal

Claude Code 대화 기록을 로컬에서 탐색하고 검토하는 웹 앱입니다. `~/.claude/projects/`의 JSONL 세션 파일을 직접 읽으며, 별도 설정이 필요 없습니다.

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

앱은 로컬 파일만 읽습니다 — 네트워크 요청 없음, 데이터 업로드 없음. 세션 데이터 경로:

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

각 `.jsonl` 파일은 하나의 Claude Code 세션에 해당하며, 전체 메시지 기록과 토큰 사용량이 포함됩니다.

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `⌘K` | 전체 텍스트 검색 열기 |
| `⌘\` | 사이드바 열기 / 닫기 |
| `Esc` | 검색 닫기 |
