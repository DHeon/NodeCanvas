# 체크리스트 노드와 역할

## 사용

- **역할:** 노드를 고르고 속성 패널 "역할"에서 **없음 / 할 일**을 고른다. 체크리스트 노드는 역할을 가질 수 없다.
  - 할 일 노드는 머리 제목 왼쪽에 둥근 체크 버튼이 생긴다. 끝내면 채워진 체크와 제목 취소선이 보인다.
  - 여러 노드를 고르면 한 번에 정한다. 섞여 있으면 "여러 가지"로 보이고, 체크리스트는 건너뛴다. "완료" 체크 상자는 하나만 골랐을 때만 보인다.
- **체크리스트 노드:** 도구 막대의 체크리스트 버튼, 단축키 `K`, 또는 "이어서 만들기" 메뉴로 만든다.
  - 할 일 노드를 연결선으로 이으면 목록에 들어가고, 선을 지우면 빠진다. 같은 노드와 선이 여러 개여도 한 번만 센다.
  - 이미 있는 노드를 이어도 역할은 자동으로 붙지 않는다. 대신 "역할이 없는 연결 노드 N개 · 할 일로 만들기" 안내가 뜬다.
  - 체크리스트에서 "이어서 만들기"로 만든 노드는 자동으로 할 일이 된다.
  - 맨 아래 "항목 추가"에 직접 항목을 쓴다(Enter). 글을 누르면 그 자리에서 고치고, 비우고 적용하면 지워진다. `×`로도 지운다.
  - 목록 체크와 노드의 체크 버튼은 같은 상태다. 연결된 항목의 제목을 누르면 그 노드로 이동해 선택한다.
  - 진행률은 연결된 할 일과 직접 항목을 합쳐 "N / M 완료 · P%"와 막대로 보여준다. 모두 끝나면 "모두 완료".
- 체크·항목 추가·고치기·지우기·역할 바꾸기·"할 일로 만들기"는 각각 실행 취소 한 단계다.
- 직접 항목 글도 검색된다(결과는 그 체크리스트).

## 데이터

```ts
NodeBase.role?: { kind: "todo"; done: boolean }   // 체크리스트 노드에는 없음
ChecklistNode = NodeBase & { type: "checklist_node"; items: ChecklistItem[] }
ChecklistItem = { id: string /* uuid */; text: string; done: boolean }
```

- 체크 상태는 할 일 노드에, 직접 항목만 체크리스트에 저장한다. 목록은 저장하지 않고 그릴 때 연결선으로 계산한다(`buildChecklist`). 같은 할 일을 체크리스트 여러 곳에 이어도 상태는 하나다.
- 목록 순서: 연결된 할 일(위치 위→아래, 왼쪽→오른쪽) 다음 직접 항목(추가한 순).
- 한도: 체크리스트당 직접 항목 200개, 글은 앞뒤 공백을 뺀 1–200자(더 길면 200자로 자른다).
- 복제(Ctrl+D)는 역할·항목을 복사하고, 함께 고른 노드끼리의 선만 복사한다.
- 스키마(`workspace-schema.ts`): 역할 모양, 체크리스트의 역할 거절, 항목 수·글·ID 중복.

## 코드

- `roles.ts`: `canHaveRole`, `setRole`, `setTodoDone`, `roleForConnectedNode`.
- `checklist.ts`: `buildChecklist`, `addChecklistItem`, `editChecklistItem`, `removeChecklistItem`, 한도 상수.
- `checklist-node-view.tsx`: 체크리스트 노드 화면. `node-frame.tsx`: 할 일 체크 버튼. `workspace-properties.tsx`: 역할 칸.

## 테스트

```bash
node --import tsx --test scripts/test-checklist.ts scripts/test-node-frame.ts
node --import tsx --test scripts/test-workspace-editing.ts scripts/test-workspace-search.ts
```
