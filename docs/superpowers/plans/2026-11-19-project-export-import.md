# 프로젝트 내보내기·불러오기 (.nono) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트를 zip 형식 `.nono` 파일로 내보내고, 그 파일을 새 프로젝트로 불러온다(이미지 포함).

**Architecture:** 압축·풀기·형식 검사·이미지 ID 바꾸기는 순수 함수 파일 `project-archive.ts`에 둔다(브라우저·서버 공용). 내보내기는 브라우저에서 이미지를 받아 묶고, 불러오기는 `POST /api/projects/import`가 검사·이미지 재인코딩·트랜잭션 생성을 한다.

**Tech Stack:** Next.js 16 route handler, Prisma 7, zod 4, sharp(기존 `normalizeImage`), fflate.

**Spec:** `docs/superpowers/specs/2026-11-19-project-export-import-design.md`

## Global Constraints

- manifest: `{ format: "nono", version: 1, title, exportedAt }`. 다른 version은 거절.
- 업로드 60MB, 풀었을 때 합계 200MB, 항목 1100개 제한.
- 문서는 `workspaceDocumentSchema`로 검사. 이미지는 `normalizeImage`로 다시 인코딩.
- 불러오기는 늘 새 프로젝트. 프로젝트·이미지·문서는 한 트랜잭션.
- 사용자 문구는 한국어.

## Review Focus

- 압축 폭탄: 선언 크기가 작아도 실제로 풀면 큰 항목 → 합계 제한으로 거절.
- `../` 같은 경로·`images/` 밖의 파일 → 무시.
- 같은 이미지를 여러 노드가 참조 → 한 번만 저장, 모든 노드가 같은 새 ID.
- 하위 캔버스 안 이미지 노드도 바뀐다.
- 이미지 파일이 깨졌거나 없는 경우 → 그 노드만 `image: null`, 나머지는 불러온다.

---

### Task 1: `project-archive.ts` 순수 함수

**Files:** Create `src/features/workspace/project-archive.ts`, Test `scripts/test-project-archive.ts`

**Interfaces (Produces):**

- `ARCHIVE_VERSION = 1`, `MAX_ARCHIVE_BYTES = 60MB`, `MAX_UNPACKED_BYTES = 200MB`, `MAX_ARCHIVE_ENTRIES = 1100`
- `class ArchiveError extends Error`
- `referencedImageIds(document: WorkspaceDocument): string[]` (중복 없음, 모든 깊이)
- `buildArchive(input: { title: string; document: WorkspaceDocument; images: Map<string, Uint8Array>; exportedAt: string }): Uint8Array`
- `readArchive(bytes: Uint8Array): { title: string; document: unknown; images: Map<string, Uint8Array> }` — 형식·버전·크기 위반은 `ArchiveError`
- `replaceImages(document: WorkspaceDocument, replacements: Map<string, ImageReference>): { document: WorkspaceDocument; missing: number }` — 맵에 없는 이미지 노드는 `image: null`, missing에 센다. 원본은 바꾸지 않는다.
- `archiveFileName(title: string): string` — 금지 글자 `_`, 빈 제목은 `nono`, `.nono` 붙임.

- [ ] 테스트: 왕복(build→read 같은 문서·이미지·제목), 버전 2 거절, manifest 없음 거절, document.json 없음 거절, 풀었을 때 200MB 초과 거절(작은 제한을 인자로 주입할 수 있게 `readArchive(bytes, limits?)`), `images/` 밖·하위 폴더 경로 무시, referencedImageIds가 하위 캔버스·중복 처리, replaceImages가 중복 참조·하위 캔버스·missing 처리, archiveFileName.
- [ ] 실패 확인 → 구현 → 통과 → 커밋.

### Task 2: 불러오기 서버

**Files:** Create `src/features/projects/import-project-server.ts`, `src/app/api/projects/import/route.ts`

**Interfaces:**

- `importProject(ownerId: string, bytes: Uint8Array, fallbackTitle: string): Promise<{ projectId: string; missingImages: number }>` — readArchive → schema 검사 → 이미지마다 normalizeImage(실패하면 missing) → `prisma.$transaction`으로 project·imageAsset·document 생성. 이미지 ID는 미리 uuid로 만들어 문서에 바꿔 넣는다.
- 라우트: 로그인·Origin 검사, 본문을 스트림으로 60MB까지 읽기, `?name=` 파일 이름(제목 대체), 응답 `{ projectId, missingImages }` 201. ArchiveError·문서 검사 실패는 400 + 한국어 메시지.

- [ ] tsc·eslint 통과, 브라우저로 Task 4에서 확인. 커밋.

### Task 3: 내보내기·불러오기 화면

**Files:** Modify `workspace.tsx`, `workspace-menu.tsx`, dashboard `page.tsx`; Create `src/features/projects/import-project-button.tsx`

- 파일 메뉴: ".nono로 내보내기"(`exportArchive`: 참조 이미지를 `/api/projects/{id}/images/{imageId}`에서 받아 `buildArchive`, 하나라도 실패하면 알림 후 중단), "불러오기"(ImportProjectButton).
- ImportProjectButton: 숨은 `<input type=file accept=".nono">` → fetch POST → 성공하면 `/projects/{id}`로 이동(missingImages > 0이면 `?missingImages=N`… 대신 sessionStorage 알림 없이 간단히: 이동 전에 alert 대신 버튼 아래 상태 글로 알리고 이동). 진행 중 "불러오는 중…", 실패 메시지 표시.
- 대시보드: 제목 줄과 빈 화면에 버튼.

### Task 4: 문서·브라우저 확인

- `docs/workspace-export-import.md` 작성, 단축키 도움말 변경 없음.
- 브라우저: 이미지 포함 프로젝트 내보내기 → 불러오기 → 새 프로젝트에 이미지가 보이는지, 하위 캔버스 포함.
- 전체 테스트·tsc·eslint, 확인용 계정 삭제.
