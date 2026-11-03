# 이미지 노드와 Inspector

## 사용

- 왼쪽 이미지 아이콘은 파일 창을 바로 열지 않고 빈 이미지 노드를 만든다.
- 빈 노드 중앙의 + 또는 Inspector의 이미지 선택 버튼으로 파일을 넣는다. 노드 빈 공간을 누르는 것만으로 파일 창이 열리지는 않는다.
- 이미지 노드 선택 후 Ctrl+V로 클립보드 이미지를 넣거나 교체할 수 있다. 입력칸 안에서는 기본 붙여넣기를 유지한다. 빈 작업 공간에서 붙여넣으면 새 이미지 노드를 만든다.
- 우선 노드 하나에 이미지 한 장을 제공한다. 갤러리·다중 이미지·파일 드롭은 이번 범위에서 제외했다.
- PNG/JPEG/WebP/GIF, 파일당 최대 10MB. 서버가 최대 4천만 픽셀까지만 디코딩하고 회전 방향을 보정한 뒤 긴 변 최대 2560px의 WebP로 저장한다. GIF는 첫 프레임만 사용한다. 변환 결과도 최대 5MB로 제한한다.
- 이미지 비율을 유지하고 전체가 보이도록 표시한다. 크기 조절과 Inspector W/H 수정도 이미지 비율을 유지한다. 캔버스 경계에 도달하면 크기 증가를 제한한다.

## Inspector

- 선택한 노드 하나의 제목·X/Y·W/H를 오른쪽 패널에서 수정한다.
- 숫자는 Enter 또는 다른 곳 클릭으로 적용하고 Esc로 취소한다. 빈 값·유효하지 않은 숫자는 적용하지 않고 캔버스 경계로 제한한다. 숫자 칸에 들어갔다 나오는 것만으로 정밀 좌표를 반올림해 저장하지 않는다.
- 텍스트 노드는 본문 편집, 이미지 노드는 교체·제거와 해상도·용량 표시를 제공한다.
- 노드 삭제는 패널 맨 아래에 고정한다. 여러 개 선택했을 때는 일괄 속성 편집 대신 안내를 표시한다.
- 패널 옆 화살표로 닫기/열기. 같은 작업 화면 안에서 사용자의 선택을 유지하므로 닫은 뒤 노드를 눌러도 자동으로 열리지 않는다. 새로고침 시에는 기본 열림 상태다.
- Inspector에서 바꾼 문서 내용은 기존 Undo/Redo와 수동 저장에 포함한다. 패널 표시 상태와 선택은 저장하지 않는다.

## 구조

- `types.ts`: `WorkspaceNode = TextNode | ImageNode` 판별 유니온. 문서에는 이미지 본문 대신 `ImageReference`(UUID·너비·높이·바이트 수)만 넣는다.
- `node-frame.tsx`: 노드 제목·이동·크기 조절·선택·연결점 공통 UI. 종류별 본문은 `text-node-view.tsx`, `image-node-view.tsx`가 담당한다.
- `node-transform.ts`: Inspector 좌표/크기 제한, 이미지 비율 계산, 이미지 교체를 순수 함수로 처리한다.
- `workspace-inspector.tsx`: 공통 설정 및 종류별 설정 UI. 문서 상태는 직접 소유하지 않고 Workspace의 수정 함수를 호출한다.
- `use-image-uploads.ts`: 파일 검증, 바이너리 업로드, 업로드 상태·오류, 같은 노드의 이전 요청 취소와 화면 종료 시 요청 정리.
- `image-upload-server.ts`: 실제 본문 크기 제한, 파일 시그니처 검증, Sharp 이미지 디코딩·회전·축소·메타데이터 제거.

## DB·API

`image_asset` 테이블에 프로젝트 ID, WebP 바이너리(bytea), 크기·용량·생성 시각을 보관한다. 프로젝트와 1:N 관계이며 프로젝트 삭제 시 함께 제거한다. 기존 `project.document` JSONB에는 이미지 참조만 보관하므로 Undo 스냅샷에 이미지 Base64가 반복되지 않는다.

1. `POST /api/projects/[projectId]/images`: 로그인·Origin·프로젝트 소유권 확인 → 파일 검증·변환 → 이미지 저장 → 참조 반환.
2. Workspace가 살아 있는 이미지 노드에 참조를 적용한다. 업로드 완료 전에 삭제된 노드를 되살리지 않는다. 이동·크기 조절 중 완료된 업로드는 제스처 종료 후 별도 이력으로 적용한다.
3. 저장 버튼 → 기존 문서 PUT. 이미지 ID·메타데이터가 이 프로젝트의 실제 자산과 일치하는지 추가 검증한다.
4. `GET /api/projects/[projectId]/images/[imageId]`: 로그인·소유권 확인 후 이미지 응답. 공개 URL이나 다른 사용자의 자산 접근은 허용하지 않는다. 캐시도 private/no-store로 제한한다.

이미지 업로드 자체는 즉시 서버에 저장되지만 **노드 배치와 이미지 연결을 문서에 확정하는 것은 기존 저장 버튼**이다. 업로드 중에는 저장을 비활성화한다.

노드의 이미지 제거·교체 시 자산을 즉시 지우지 않는다. Undo·다른 탭·미저장 문서의 참조를 보호하기 위한 것이다. 현재는 프로젝트 삭제 시 함께 정리한다. 대량 사진·서비스 운영 단계에서는 객체 스토리지, 썸네일, 프로젝트 용량 제한과 참조를 고려한 미사용 자산 정리가 후속 작업이다. 현재 구현을 대량 이미지 최적화 완료로 보지는 않는다.

## 설치·검증

```powershell
npm install
npx prisma generate
npx prisma migrate deploy
node --import tsx --test scripts/test-workspace-editing.ts scripts/test-workspace-images.ts scripts/test-workspace-save-client.ts scripts/test-app-origins.ts
npm run build
```

로컬 서버와 Docker DB를 켠 뒤 통합 테스트:

```powershell
node --import tsx scripts/test-workspace-images-integration.ts
```

통합 테스트는 임시 계정과 프로젝트만 생성하고 finally에서 해당 데이터만 제거한다. 익명·타 사용자·잘못된 Origin·과대 파일·위장 파일·다른 프로젝트 이미지 참조를 거절하는지, 업로드·DB 저장·문서 재조회·Undo용 자산 보존·프로젝트 삭제 연쇄를 검증한다.
