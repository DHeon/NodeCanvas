---
name: nono
description: 노드 기반 작업 공간. 생각을 펼쳐 두는 조용한 작업 책상.
colors:
  forest-ink: "#30382d"
  forest-ink-hover: "#434e3f"
  moss: "#97a87b"
  moss-focus: "#7a8f52"
  ochre-clay: "#a88a60"
  bark-text: "#252c26"
  lichen-text: "#697164"
  paper-sage: "#f8f9f4"
  canvas-field: "#f0f2e9"
  sage-mist: "#eef0e8"
  sage-mist-hover: "#e6e9de"
  sage-rule: "#d9ded1"
  surface: "#ffffff"
  sage-hover: "#a1ad8c"
  sage-dot: "#c5ccb6"
  ochre-wash: "#eee9df"
  caution-wash: "#fdf6ea"
  caution-rule: "#f1d9b5"
  danger: "#dc2626"
  danger-wash: "#fef2f2"
typography:
  wordmark:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.04em"
  hero:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "clamp(26px, 3.2vw, 36px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.4px"
  lead:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  title:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  body:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.71
  label:
    fontFamily: "Geist, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  xs: "6px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  shell: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.forest-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.forest-ink-hover}"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bark-text}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bark-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  node-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bark-text}"
    rounded: "{rounded.lg}"
  project-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  floating-toolbar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "7px"
---

# Design System: nono

## Overview

**Creative North Star: "The Quiet Desk"**

nono는 생각을 펼쳐 두는 조용한 작업 책상이다. 화면의 주인공은 사용자가 놓은 메모와 이미지이며, 도구는 책상 가장자리에 놓인 문구류처럼 필요할 때만 손에 잡힌다. 바탕은 희미하게 초록 기운이 도는 종이(Paper Sage)이고, 노드는 그 위에 놓인 흰 카드다. 색은 이끼·숲·흙에서 가져온 낮은 채도의 톤만 쓰며, 진한 숲색(Forest Ink)은 화면에서 가장 중요한 한 가지 행동에만 쓴다.

컴포넌트는 부드럽고 손에 잡히는 감각을 가진다. 넉넉한 둥근 모서리, 아래로 길게 깔리는 흐린 그림자, 잡고 끌 수 있다는 것이 보이는 카드 머리. 다만 장식은 하지 않는다. 밀도는 작업 도구답게 촘촘하되(14px 본문, 12px 라벨) 여백으로 숨 쉴 자리를 남긴다.

이 체계는 랜딩·로그인·대시보드와 캔버스 편집기(`src/features/workspace`)에 적용되어 있다. 색·그림자 토큰은 `src/app/globals.css`의 `@theme`에 정의되어 Tailwind 유틸리티(`bg-ink`, `text-lichen`, `border-rule`, `shadow-card` 등)로 쓴다.

**Key Characteristics:**

- 초록 기운의 종이 바탕 위 흰 카드, 순수 회색 대신 세이지 계열 중립색
- 단 하나의 진한 숲색 주요 버튼
- 12–18px의 부드러운 모서리와 아래로 깔리는 확산형 그림자
- 한국어 본문 우선(`word-break: keep-all`), Geist + 시스템 한글 글꼴
- 도구는 떠 있는 작은 패널로 물러나 있고 캔버스가 화면 대부분을 차지

## Colors

이끼 낀 종이와 숲 그늘에서 가져온 낮은 채도의 따뜻한 녹회색 팔레트.

### Primary

- **Forest Ink** (`forest-ink`): 화면의 주요 행동 하나(로그인, 프로젝트 만들기, 대시보드로 이동). 호버 시 **Forest Ink Hover**(`forest-ink-hover`)로 한 단계 밝아진다.

### Secondary

- **Moss** (`moss`): 선택 상태와 진행 신호. 선택된 노드 테두리, 체험 배지의 점. 면을 칠하지 않고 선·점·옅은 링(`#b6c7941a`)으로만 쓴다.
- **Moss Focus** (`moss-focus`): 키보드 포커스 외곽선(2px, offset 4px).

### Tertiary

- **Ochre Clay** (`ochre-clay`): 이미지 노드 아이콘처럼 노드 종류를 구분하는 보조 표식. 텍스트 노드는 Moss 계열(`#7b8f51` on `#ecf1df`), 이미지 노드는 Ochre(`#a88a60` on `#eee9df`).

### Neutral

- **Bark** (`bark-text`): 본문·제목 글자색. 순수 검정 대신.
- **Lichen** (`lichen-text`): 보조 글자, 내비게이션 링크, 안내 문구.
- **Paper Sage** (`paper-sage`): 페이지 바탕(랜딩, 로그인, 대시보드).
- **Canvas Field** (`canvas-field`): 캔버스 작업 영역 바탕. 22px 간격의 Sage Dot(`sage-dot`) 점 격자를 깐다.
- **Sage Mist** (`sage-mist`): 카드 안 빈 영역·미리보기 자리. 호버 시 `sage-mist-hover`.
- **Sage Rule** (`sage-rule`): 테두리와 구분선.
- **Surface** (`surface`): 노드 카드, 패널, 입력창 바탕.
- **Danger** (`danger`) / **Danger Wash** (`danger-wash`): 오류 문구와 삭제 버튼. 삭제처럼 되돌리기 어려운 행동에만.

### Named Rules

**The One Ink Rule.** Forest Ink로 칠한 버튼은 한 화면에 하나다. 두 번째 행동은 테두리만 있는 조용한 버튼이 된다.

**The No Pure Gray Rule.** 중립색은 세이지 쪽으로 기운 녹회색이다. Tailwind `neutral-*` 순수 회색을 새로 쓰지 않는다.

## Typography

**Display/Body Font:** Geist (Apple SD Gothic Neo, Malgun Gothic, sans-serif로 대체)
**Label/Mono Font:** Geist Mono (배지, 좌표, 작은 기술 표식)

**Character:** 기하학적이지만 차갑지 않은 Geist와 운영체제 한글 고딕의 조합. 제목은 살짝 좁힌 자간(-0.4px)으로 단정하게, 본문은 넉넉한 행간으로 읽힌다.

### Hierarchy

- **Wordmark** (600, 24px, -0.04em): `nono.` 로고 글자. 랜딩·인증·대시보드 헤더.
- **Hero** (600, clamp 26–36px, 1.25): 랜딩의 한 문장 제목. 제품 전체에서 하나.
- **Lead** (400, 15px, 1.7, Lichen): Hero 아래 한두 줄 설명.
- **Display** (600, 30px, 1.2): 대시보드 "내 프로젝트" 같은 페이지 제목. 한 화면에 하나.
- **Headline** (500, 17px, -0.4px): 랜딩 섹션 제목, 패널 제목.
- **Title** (500, 14px): 노드 제목, 편집기 헤더의 프로젝트 이름, 버튼 글자.
- **Body** (400, 14px, 24px 행간): 텍스트 노드 본문, 안내 문구. `word-break: keep-all`.
- **Label** (500, 12px): 입력 라벨, 경로 표시줄, 상태 문구. 숫자(좌표, 확대 비율, 노드 수)는 `tabular-nums`.

제목 위에 작은 대문자 라벨(eyebrow)을 얹지 않는다. 제목이 스스로 무게를 가진다.

### Named Rules

**The Content Is Loudest Rule.** 사용자가 쓴 노드 내용보다 큰 글자를 도구 크롬에 쓰지 않는다. 편집기 크롬은 Title(14px) 이하.

## Layout

- 랜딩·대시보드: 최대 폭 1184px(`min(1184px, 100% - 64px)`) 가운데 정렬, 세로 여백 24–40px. 프로젝트 카드는 180–220px 폭의 자동 채움 격자, 간격 20px.
- 편집기: 화면 전체를 쓰는 고정 레이아웃. 위에서부터 헤더(최소 56px) → 메뉴 줄 → 경로 표시줄(하위 캔버스에서만) → 캔버스. 왼쪽에 세로로 떠 있는 도구 막대(18px 띄움), 오른쪽에 접을 수 있는 Properties 패널(288px, 최대 45vw).
- 간격 리듬은 4px 단위: 4 / 8 / 16 / 24 / 40. 패널 안 구획은 24px 간격에 구분선, 구획 안 항목은 12px.
- 노드 기본 크기: 텍스트 320×220, 이미지 360×280, 캔버스 260×140. 노드 머리 높이 48px.

## Elevation & Depth

평평한 종이 위에 카드가 살짝 떠 있는 구조. 그림자는 항상 세이지 기운의 어두운 녹색(`#445237`, `#344524`)을 투명하게 쓰고, 아래로 길게 퍼지며 바깥으로는 거의 번지지 않는다(음수 spread).

### Shadow Vocabulary

- **Card Rest** (`box-shadow: 0 7px 18px -10px #44523735`): 캔버스 위 노드 카드의 기본 상태.
- **Card Lift** (`box-shadow: 0 12px 26px -14px #44523755`): 노드 호버, 잡기 직전.
- **Card Selected** (`box-shadow: 0 0 0 3px #b6c79459, 0 12px 26px -14px #44523740`, `shadow-card-selected`): 선택된 노드. Moss 링 + Lift.
- **Shell** (`box-shadow: 0 18px 70px -40px #3445244a, 0 2px 5px #34452404`): 큰 패널, 체험 캔버스 틀.
- **Floating Tool** (`box-shadow: 0 16px 45px -12px #3445242e, 0 2px 5px #34452408`, `shadow-float`): 떠 있는 도구 막대(`backdrop-filter: blur(18px)`와 함께)와 메뉴 팝오버.

### Named Rules

**The Lift Means Grab Rule.** 그림자가 커지는 것은 "잡을 수 있다"는 신호다. 잡을 수 없는 요소에는 Lift를 쓰지 않는다.

## Shapes

부드럽게 둥근 모서리가 체계 전체를 묶는다. 작은 요소일수록 작은 반경: 아이콘 칩·작은 버튼 6px, 입력 안쪽 요소 4px, 입력창·버튼 8px, 노드 카드 12px, 프로젝트 카드·도구 막대 16px, 큰 틀 18px. 연결점과 배지 점은 완전한 원. 노드 내부는 카드 반경을 그대로 상속해(`rounded-[inherit]`, CSS에서는 카드 반경에서 테두리 1px을 뺀 11px) 머리와 본문이 한 덩어리로 보인다. 테두리는 1px Sage Rule이 기본이고, 선택·포커스에서만 색이 바뀐다.

## Components

### Buttons

도톰하고 누르고 싶은 형태. 장식 없이 색과 그림자 변화만으로 상태를 보여준다.

- **Shape:** 부드러운 모서리(8px), 최소 높이 36–40px.
- **Primary:** Forest Ink 바탕에 흰 글자, 8px 16px 안쪽 여백, 14px Title 글자. 호버 시 Forest Ink Hover.
- **Quiet:** 흰 바탕, 1px Sage Rule 테두리, 호버 시 Sage Mist 바탕. 저장·실행 취소 같은 두 번째 행동.
- **Danger:** Danger Wash 바탕, Danger 글자, 옅은 붉은 테두리. Properties 패널 맨 아래 삭제.
- **Focus:** 2px Moss Focus 외곽선, 4px 띄움.
- **Disabled:** 불투명도 50%, 진행 중이면 `cursor: wait`.

### Cards / Containers

- **Node card:** 흰 바탕, 1px Sage Rule 테두리, 12px 모서리, Card Rest 그림자. 머리(48px)는 잡아서 끄는 손잡이이며 약간 밝은 바탕(`#fdfefb`)과 아래 구분선을 가진다. 머리 왼쪽에 노드 종류 아이콘 칩.
- **Project card:** 흰 바탕, 16px 모서리, 위쪽 정사각형 미리보기 자리는 Sage Mist(호버 시 한 단계 진하게), 아래에 제목과 메뉴.
- **Shell:** 체험 캔버스·큰 패널 틀. 18px 모서리, Shell 그림자.

### Inputs / Fields

- **Style:** 흰 바탕, 1px Sage Rule 테두리, 8px 모서리, 8px 12px 여백, 14px 글자.
- **Focus:** 테두리가 Moss로 바뀌고 옅은 Moss 링(2px).
- **Error / Disabled:** 오류 문구는 입력 아래 12px Danger 글자(`role="alert"`). 비활성은 Sage Mist 바탕에 Lichen 글자.

### Navigation

- **Landing header:** 왼쪽 브랜드, 오른쪽 Lichen 색 링크(호버 시 Bark)와 Primary 버튼 하나.
- **Editor header:** 흰 바탕, 아래 구분선. 왼쪽 "프로젝트 목록" 링크, 가운데 현재 캔버스 제목(Title), 오른쪽 저장 상태 문구와 실행 취소·다시 실행·휴지통·저장 버튼.
- **Breadcrumb:** 하위 캔버스 안에서만 보이는 12px 경로 줄. 현재 위치는 Bark 500, 상위 경로는 Lichen 링크.

### Auth Card

Paper Sage 바탕 가운데 흰 카드(16px 모서리, Card Rest 그림자, 최대 폭 400px). 제목(24px 600) → 한 줄 설명(Lichen) → 라벨 달린 입력칸 → 폭 전체의 Primary 버튼. 카드 아래에 로그인·회원가입 전환 링크.

### Project Card

흰 카드(16px). 위쪽 4:3 영역은 Canvas Field 점 격자 위에 최상위 노드를 축소한 미니 캔버스(텍스트 흰색, 이미지 Ochre Wash, 캔버스 Moss Wash). 아래에 제목(카드 전체가 제목 링크로 열림)과 "노드 N개 · N일 전 수정". 호버는 Card Lift, 키보드 포커스는 Moss Deep 테두리.

### Caution Panel

저장 충돌처럼 사용자의 선택이 필요한 경고. Caution Wash(`#fdf6ea`) 띠에 Caution Rule 테두리, 제목·설명과 세 행동(조용한 버튼 둘 + Primary 하나). 빨강은 실패에만 쓰고 결정 요청에는 쓰지 않는다.

### Text Node Style

텍스트 노드 글 전체에 적용하는 스타일. 글꼴은 기본(Geist + 시스템 고딕), 명조(Gowun Batang, `font-serif`), 손글씨(Gaegu, `font-hand`), 고정폭(나눔고딕코딩, `font-code`). 크기는 13 / 14(기본) / 18 / 24px. 글자 색 8가지는 흰 바탕 대비 4.5:1 이상인 짙은 톤(기본 Bark `#252c26`, 이끼 `#4f6234`, 청록 `#2e6270`, 남색 `#44559a`, 보라 `#6f4b8c`, 장미 `#a23d63`, 주황 `#9e522f`, 황토 `#7a5d1c`). 속성 패널에서는 칸 나눔 선택(선택된 칸만 Forest Ink)과 색 원으로 고른다.

### Link Node

유튜브는 제목 바 아래를 플레이어로 꽉 채우고(바탕 Bark), 띄울 수 있는 웹페이지는 흰 바탕 iframe으로 보여준다. 막힌 사이트는 미리보기 카드: 위 40%에 대표 이미지, 아래에 링크 아이콘과 사이트 이름(12px Lichen), 제목(14px 500 Bark, 2줄), 설명(12px Bark Soft, 3줄), 맨 아래 "새 탭에서 열기" 밑줄 링크. 주소가 없을 때는 Paper 바탕 가운데 입력칸(라벨은 스크린리더 전용)과 Forest Ink 정사각 실행(▶) 아이콘 버튼.

### Image Viewer

이미지 노드를 화면 가득 보는 모달. Bark 85% 배경에 흐림, 위쪽에 제목·해상도와 흰 글자 도구 버튼(원본 크기/화면에 맞추기, 닫기). 그림은 12px 모서리와 Floating Tool 그림자로 떠 있고, 150ms 페이드로만 나타난다(움직임 줄이기 설정이면 없음). 어두운 여백을 누르거나 Esc로 닫는다.

### Notice

캔버스 아래 가운데에 잠깐(6초) 뜨는 Bark 바탕 흰 글자 안내. 제한에 걸렸을 때처럼 동작이 일어나지 않은 이유를 알린다.

### Floating Toolbar (signature)

캔버스 왼쪽 가운데에 떠 있는 세로 도구 막대. 흰 95% 반투명 바탕에 블러, 16px 모서리, 7px 안쪽 여백, 40×40 아이콘 버튼(11px 모서리)이 5px 간격으로 쌓인다. 호버는 아주 옅은 어둠(6%), 누름은 10%.

### Connection Line (signature)

노드 사이를 잇는 2px 선, 확대와 무관하게 두께 유지. 모양은 캔버스마다 고른다: 부드러운 베지어 곡선(기본) 또는 90도로 꺾이고 모서리가 8px로 살짝 둥근 각진 선. 색은 선마다 8색 팔레트에서 고르며 기본은 Lichen이다(이끼 회색 `#697164`, 이끼색 `#7a8f52`, 청록 `#3f7d8c`, 남색 `#5b6fb0`, 보라 `#8a63a8`, 장미 `#c0567a`, 주황 `#c4704a`, 황토 `#9c7a2e`; 모두 Canvas Field 위 대비 3:1 이상). 선택하면 3px로 굵어지고 같은 색의 옅은 띠(22%)가 깔린다. 그리는 중인 선은 Moss Deep 점선. 연결점은 노드 네 변 가운데의 작은 원(8px, Moss Deep 테두리)으로, 노드에 마우스를 올리거나 포커스할 때만 나타난다.

### Selection

선택된 노드는 Moss Deep 테두리 + Card Selected 그림자, 범위 선택 사각형은 Moss Deep 테두리에 Moss 15% 채움. 선택을 나타내는 색은 Moss 계열 하나뿐이다.

## Do's and Don'ts

### Do:

- **Do** 페이지 바탕은 Paper Sage(`#f8f9f4`), 캔버스 작업 영역은 Canvas Field(`#f0f2e9`)에 22px 점 격자를 쓴다.
- **Do** 선택·포커스는 Moss 계열로 표시한다. 흰 바탕 위 테두리·포커스 링은 대비 3:1을 넘는 Moss Deep(`#7a8f52`), 옅은 Moss(`#97a87b`)는 링·채움에만.
- **Do** 그림자는 세이지 녹색 기반의 아래로 깔리는 확산형만 쓴다(Elevation의 Shadow Vocabulary).
- **Do** 한국어 문장은 `word-break: keep-all`로 단어 중간에서 끊지 않는다.
- **Do** 색은 `globals.css` `@theme` 토큰 유틸리티(`bg-paper`, `border-rule`, `text-lichen`, `outline-moss-deep` …)로 쓴다. 임의 hex를 클래스에 직접 넣지 않는다.
- **Do** 아이콘은 `src/features/workspace/icons.tsx`의 1.8 굵기 선 아이콘을 쓴다. `←`, `↗`, `+` 같은 글자를 아이콘 대신 쓰지 않는다.
- **Do** 저장은 자동이다. 편집기의 저장 버튼은 조용한 버튼("지금 저장")이고, 상태는 버튼 옆 문구("편집 중… / 저장 중… / 저장됨 · 시각")로 알린다.
- **Do** 인증·대시보드·오류 화면은 `src/features/shell`의 워드마크 헤더(`SiteHeader`)와 공통 스타일(`primaryButton`, `quietButton`, `textInput`)을 쓴다.
- **Do** 입력칸에는 항상 눈에 보이는 12px 라벨을 둔다. placeholder는 예시일 뿐 라벨이 아니다.
- **Do** 화면에 쓰는 글자는 12px 이상이다(축소되는 캔버스 안의 노드 내용은 예외).

### Don't:

- **Don't** Forest Ink 채움 버튼을 한 화면에 두 개 이상 두지 않는다.
- **Don't** Tailwind 기본 `neutral-*`, `blue-*`, `violet-*`를 새 UI에 추가하지 않는다.
- **Don't** 노드 내용보다 눈에 띄는 크롬(큰 글자, 진한 바탕의 툴바, 화려한 강조색)을 만들지 않는다.
- **Don't** 순수 검정(`#000`) 글자나 순수 회색 그림자(`rgba(0,0,0,…)`)를 쓰지 않는다.
