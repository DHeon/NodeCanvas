# 노드 그룹

## 사용

- **만들기:** 노드를 1개 이상 고른 뒤 `G`, 또는 노드 우클릭 → "그룹화". 기본 이름은 "그룹".
  - 다른 그룹에 있던 노드는 새 그룹으로 옮겨가고, 그래서 비게 된 그룹은 사라진다.
- **보이는 모습:** 묶인 노드를 사방 32px 여유로 감싸는 반투명 영역과, 왼쪽 위 모서리 위에 붙은 이름 탭.
- **들어가기:** 그룹 없는 노드를 끌어 그룹 영역 위에서 놓는다. 끄는 동안 그 그룹이 진해진다.
  - 끄는 노드가 **모두** 그룹이 없을 때만 들어간다. 그룹 멤버와 함께 끌면 아무 그룹에도 들어가지 않는다.
  - 겹친 그룹 위에서는 나중에 만든 그룹으로 들어간다.
- **멤버 옮기기:** 멤버를 영역 밖으로 끌어도 빠지지 않고 영역이 따라 늘어난다.
- **빠지기:** 그룹에 속한 노드를 우클릭 → "그룹화 해제", 또는 `Shift+G`. 마지막 멤버가 빠지면 그룹이 사라진다.
- **이름 탭:**
  - 끌면 그룹 전체가 이동한다(유한 캔버스면 범위 안에서 멈춘다). 짧게 누르면 멤버 모두를 선택한다.
  - 두 번 누르거나 `Enter`로 이름을 고친다(40자까지, 비우면 "그룹").
  - `Tab`으로 포커스할 수 있고, `Space`는 멤버 모두 선택(그 뒤 방향키로 그룹째 이동).
- **우클릭 메뉴:** 노드 위에서만 열린다. 선택에 없는 노드를 우클릭하면 그 노드만 선택한다. 메뉴 키·`Shift+F10`으로도 연다.
- 그룹 안 빈 곳은 캔버스와 같다(누르면 선택 해제, 끌면 범위 선택).
- 만들기·해제·들어가기·탭 이동·이름 바꾸기는 각각 실행 취소 한 단계.

## 데이터

```ts
NodeBase.groupId?: string                       // 같은 공간의 그룹 ID
WorkspaceDocument.groups?: { id: string; title: string }[]   // 공간마다
```

- 영역은 저장하지 않는다. 그릴 때 멤버 노드 위치로 계산한다(`groupBounds`).
- 노드는 한 그룹에만 속하고, 그룹은 중첩되지 않는다. 하위 캔버스는 자기 그룹만 가진다.
- 한도: 공간당 그룹 200개(넘으면 알림). 이름은 앞뒤 공백을 뺀 1–40자.
- 스키마(`workspace-schema.ts`): 그룹 ID 유일, 노드의 `groupId`가 같은 공간의 그룹에 있는지. 멤버 없는 그룹은 허용한다(어떤 삭제 경로로도 저장이 거절되지 않게). 편집 함수가 빈 그룹을 정리하고, 화면은 그리지 않는다.
- 복제(Ctrl+D)한 노드는 원본과 같은 그룹에 들어간다.

## 코드

- `groups.ts`: `groupBounds`, `visibleGroups`, `groupAtPoint`, `canJoinByDrag`, `groupNodes`, `ungroupNodes`, `joinGroup`, `renameGroup`, `pruneEmptyGroups`.
- `group-layer.tsx`: 영역과 이름 탭. `node-context-menu.tsx`: 노드 우클릭 메뉴.
- `workspace.tsx`: `startGroupDrag`(노드 끌기 제스처 재사용), 끌어서 들어가기, `groupSelection`·`ungroupSelection`.

## 테스트

```bash
node --import tsx --test scripts/test-node-groups.ts scripts/test-workspace-editing.ts
```
