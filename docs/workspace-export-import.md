# 프로젝트 내보내기·불러오기 (.nono)

## 사용

- **내보내기:** 작업 공간 메뉴 "파일" → ".nono로 내보내기". 하위 작업 공간·태그·그룹·이미지까지 프로젝트 전체가 `제목.nono` 파일 하나로 내려받아진다. 저장하기 전 편집도 들어간다.
  - 이미지를 하나라도 받아오지 못하면 내보내지 않고 알린다(이미지 빠진 백업을 만들지 않는다).
- **불러오기:** 프로젝트 목록의 ".nono 불러오기", 또는 작업 공간 "파일" → ".nono 불러오기". 파일을 고르면 **새 프로젝트**가 생기고 그리로 이동한다. 지금 프로젝트는 바뀌지 않는다.
  - 제목은 파일 속 제목, 없으면 파일 이름.
  - 파일에 빠졌거나 읽을 수 없는 이미지는 빈 이미지 노드로 두고, 열린 프로젝트에서 "이미지 N개는 … 빈 이미지로 두었어요"를 한 번 알린다.
  - 거절하는 경우(메시지가 버튼 아래 뜬다): zip이 아니거나 손상, 이 앱보다 새 버전 파일, 문서 형식이 틀림, 60MB 초과, 풀었을 때 200MB 초과, 항목 1100개 초과.
- 충돌 패널의 "내 편집 내려받기"는 예전처럼 문서 JSON만 받는다(.nono 아님).

## 파일 형식 (버전 1)

```
제목.nono (zip)
├── manifest.json   { "format": "nono", "version": 1, "title": "...", "exportedAt": "ISO 시각" }
├── document.json   루트 문서(저장 형식 그대로)
└── images/<이미지ID>.webp
```

- JSON은 압축하고 이미지(이미 webp)는 그대로 담는다.
- `images/` 바로 아래 `.webp`만 읽는다. 다른 경로·하위 폴더는 무시한다.
- 형식이 바뀌면 `version`을 올리고 `readArchive`에서 옛 버전을 변환한다.

## 서버 처리 (`POST /api/projects/import`)

1. 로그인·Origin 검사.
2. 본문을 스트림으로 읽으며 60MB에서 멈춘다.
3. 풀기 전 선언 크기 합·항목 수, 푼 뒤 실제 크기 합을 한도와 비교한다(압축 폭탄 방지).
4. manifest 형식·버전, 문서를 저장과 같은 스키마로 검사한다.
5. 이미지마다 업로드와 같은 처리(`normalizeImage`: 형식 확인·webp 재인코딩)를 하고 새 ID를 준다. 같은 이미지를 여러 노드가 쓰면 한 번만 저장한다.
6. 프로젝트·이미지를 한 트랜잭션으로 만든다. 실패하면 아무것도 남지 않는다.

## 코드

- `src/features/workspace/project-archive.ts`: `buildArchive`, `readArchive`, `referencedImageIds`, `replaceImages`, `archiveFileName` (브라우저·서버 공용 순수 함수).
- `src/features/projects/import-project-server.ts`: `readArchiveBody`, `importProject`.
- `src/app/api/projects/import/route.ts`: 불러오기 API.
- `src/features/projects/import-project-button.tsx`: 불러오기 버튼(대시보드·파일 메뉴).
- `workspace.tsx`: `exportArchive`, 불러온 뒤 알림 표시.

## 테스트

```bash
node --import tsx --test scripts/test-project-archive.ts
```
