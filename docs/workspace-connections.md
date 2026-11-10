# 8주차: 연결점 스냅과 연결선 선택·삭제

## 조작

- 노드에 마우스를 올리면 상하좌우 연결점이 나타난다.
- 점에서 왼쪽 버튼으로 드래그한다. 다른 노드의 점으로부터 화면 기준 18px 이내이면 가장 가까운 연결점에 붙는다.
- 스냅된 점은 보라색으로 강조되고 주위에 원이 생긴다. 미리보기는 스냅 전 점선, 스냅 후 실선이다.
- 범위를 벗어나면 다시 커서를 따라간다. 놓는 순간 대상을 다시 계산해 유효할 때만 연결한다.
- 빈 공간에 놓거나 Escape·창 전환·포인터 취소가 발생하면 연결하지 않는다.
- 연결선을 클릭하면 파란색으로 선택된다. 선택한 선은 Delete / Backspace 또는 상단 휴지통으로 삭제한다.
- Tab으로 연결선에 포커스한 다음 Enter / Space로 선택할 수도 있다.
- 노드와 연결선은 동시에 선택하지 않는다. 빈 공간 클릭과 Escape는 선택을 해제한다. 박스 선택은 노드만 대상으로 한다.
- 연결 생성·삭제는 각각 Undo 한 단계다. 노드를 삭제하면 연결된 선도 함께 삭제되고 Undo로 함께 복원된다.

## 선 모양·점 배경·선 색

- 메뉴바 **보기**에서 지금 열린 캔버스의 연결선 모양(곡선 / 각진 선)과 점 배경 표시를 바꾼다. 하위 캔버스마다 따로 저장되고(`canvas.lineStyle`, `canvas.grid`), 새 하위 캔버스는 부모의 설정을 물려받는다. 값이 없는 이전 문서는 곡선·점 배경 표시로 열린다.
- 각진 선은 연결점에서 수평·수직으로 빠져나와 90도로 꺾이고, 모서리는 8px로 살짝 둥글다(`getStyledConnectionPath`). 마주 보는 연결점은 가운데에서 한 번, 뒤쪽으로 돌아가야 하면 두 노드 사이 높이로, 같은 쪽을 보는 연결점은 바깥쪽 세로선으로 감싼다. 다른 노드를 피해 가지는 않는다.
- 연결선을 선택하면 속성 패널이 "연결선"으로 바뀌고 8가지 색(`connection-colors.ts`) 중 하나를 고른다. 색은 값이 아니라 이름(`lichen`, `rose` …)으로 `connection.color`에 저장한다. 기본색(`lichen`)은 저장하지 않는다. 나중에 테마가 생기면 이름을 테마별 색으로 바꿔 보여주면 된다.
- 선택·호버한 선은 고유 색을 유지한 채 같은 색의 옅은 띠로 표시한다.

## 코드 흐름

1. `text-node-view.tsx`의 연결점 pointerdown → `workspace.tsx`의 `startNodeConnection`: 출발점과 임시 드래그 상태 기록.
2. `moveGesture` → `getCanvasPoint`: 화면 좌표를 카메라 이동·확대율로 역변환.
3. `getConnectionHover` → `connections.ts`의 `findConnectionTarget`: 네 방향 연결점과의 캔버스 거리에 확대율을 곱해 화면 거리 계산. 가까운 유효 점 선택.
4. 스냅된 경우 미리보기 끝점을 대상 연결점 좌표로 대체하고 `connectionDraft`만 갱신한다. 문서와 Undo 이력은 아직 바꾸지 않는다.
5. `endGesture`에서 놓는 위치를 재검사한 후 `workspace.connections`에 UUID·출발점·도착점 추가.
6. `connection-layer.tsx`가 노드의 현재 좌표와 크기에서 연결점 좌표를 계산해 SVG 베지어 곡선 표시. 화면 기준 14px의 투명 stroke를 별도로 두어 얇은 선을 선택하기 쉽게 한다.
7. `selectConnection`은 노드 선택을 해제하고 연결선 ID만 기억한다. `deleteSelection`은 선택한 선만 제거하며 노드는 유지한다.

자기 노드 연결과 동일한 연결점 쌍의 중복(역방향 포함)은 제외한다. 커서가 노드 위에 있으면 그 노드의 연결점만 대상으로 하여 뒤에 겹친 노드로 잘못 연결되는 것을 줄인다. 연결 수는 기존 저장 스키마와 동일하게 최대 3000개다.

## 저장

별도 테이블이나 마이그레이션은 없다. 기존 `project.document` JSONB의 `connections` 배열을 사용한다. 저장 버튼을 눌러야 서버에 반영된다. 스냅 후보·선택·포커스는 저장하지 않는다.

이번 검증은 순수 계산·실제 이벤트 핸들러 테스트, 저장 클라이언트의 요청/응답 왕복 모킹, 임시 문서의 브라우저 조작 및 프로덕션 빌드로 진행했다. 실제 DB 쓰기·재조회 통합 테스트는 별도다.

## 이번 범위에서 제외

연결선 라벨, 선마다 다른 모양, 직접 색 고르기, 선 굵기, 화살표, 장애물 회피, 연결점 재배치와 연결선 다중 선택은 구현하지 않았다. 베지어 곡선은 연결점의 방향만 반영하며 다른 노드를 우회하지 않는다.

## 검증 명령

```powershell
node --import tsx --test scripts/test-workspace-editing.ts scripts/test-workspace-save-client.ts scripts/test-app-origins.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/features/workspace scripts/test-workspace-editing.ts scripts/test-workspace-save-client.ts
npm run build
```
