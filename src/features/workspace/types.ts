import type { DrawingStroke } from "./drawing";
import type { ConnectionColor } from "./connection-colors";
import type { ConnectionLineStyle } from "./connections";
import type { TextStyle } from "./text-style";
import type { LinkPreview } from "./link-embed";

//좌표
export type Point = {
  x: number;
  y: number;
};

//카메라 좌표
export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type NodeBase = {
  id: string;
  position: Point;
  width: number;
  height: number;
  title: string;
  // 루트 문서 tags 목록의 TagDefinition.id. 비면 필드를 생략한다.
  tags?: string[];
  /** 노드의 역할. 없으면 역할 없음. 체크리스트 노드에는 붙지 않는다. */
  role?: NodeRole;
  /** 같은 공간의 그룹 ID. 없으면 그룹 없음. 노드는 한 그룹에만 속한다. */
  groupId?: string;
};

/** 역할은 나중에 종류가 늘어나도록 kind로 구분한다. */
export type NodeRole = { kind: "todo"; done: boolean };

/** 프로젝트 공용 태그. 루트 문서에만 목록이 있고 하위 캔버스가 함께 쓴다. */
export type TagDefinition = {
  id: string;
  name: string;
  color: ConnectionColor;
};

// 노드 종류별 내용만 나누고 좌표·크기·연결 동작은 공유한다.
export type TextNode = NodeBase & {
  type: "text_node";
  text: string;
  // 노드 글 전체의 스타일. 없으면 기본(고딕·보통·왼쪽·기본색).
  textStyle?: TextStyle;
};

export type ImageReference = {
  id: string;
  width: number;
  height: number;
  byteLength: number;
};

export type ImageNode = NodeBase & {
  type: "image_node";
  image: ImageReference | null;
};

// 캔버스 노드 ID는 현재 공간에서 하위 문서를 찾는 경로가 된다.
export type CanvasNode = NodeBase & {
  type: "canvas_node";
  document: WorkspaceDocument;
};

// 유튜브·웹페이지를 노드 안에 띄운다. url이 빈 문자열이면 아직 주소를 넣지 않은 상태.
export type LinkNode = NodeBase & {
  type: "link_node";
  url: string;
  preview?: LinkPreview;
};

/** 체크리스트 안에서 직접 쓴 항목. */
export type ChecklistItem = { id: string; text: string; done: boolean };

/** 연결된 할 일과 직접 쓴 항목을 모아 진행률을 보여주는 노드. */
export type ChecklistNode = NodeBase & {
  type: "checklist_node";
  items: ChecklistItem[];
};

export type WorkspaceNode =
  TextNode | ImageNode | CanvasNode | LinkNode | ChecklistNode;
export type NodeTransformPatch = Partial<
  Point & { width: number; height: number }
>;

export type ConnectionSide = "top" | "right" | "bottom" | "left";

export type ConnectionEndpoint = {
  nodeId: string;
  side: ConnectionSide;
};

export type NodeConnection = {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  // 팔레트 이름(connection-colors.ts). 없으면 기본색.
  color?: ConnectionColor;
};

// 드래그 중에만 사용하는 미리보기. 저장되는 문서에는 포함하지 않는다.
export type ConnectionDraft = {
  source: ConnectionEndpoint;
  pointer: Point;
  hoveredNodeId: string | null;
  target: ConnectionEndpoint | null;
  /** 다중 선택에서 함께 끌려 나오는 나머지 노드의 출발점(잡은 점과 같은 변). */
  others?: ConnectionEndpoint[];
};

//캔버스 데이터
export type WorkspaceDocument = {
  canvas: {
    width: number;
    height: number;
    // 이전 문서에 없으면 유한 캔버스로 처리한다.
    infinite?: boolean;
    // 공간마다 따로 정하는 보기 설정. 없으면 곡선·점 배경 표시.
    lineStyle?: ConnectionLineStyle;
    grid?: boolean;
  };
  nodes: WorkspaceNode[];
  connections: NodeConnection[];
  // 루트 문서에만 있는 프로젝트 태그 목록. 없으면 태그 없음.
  tags?: TagDefinition[];
  // 공간마다 따로 저장하는 손그림. 없으면 그림 없음.
  drawing?: { strokes: DrawingStroke[] };
  /** 이 공간의 그룹 이름 목록. 영역은 멤버 노드 위치로 그릴 때 계산한다. */
  groups?: NodeGroup[];
};

/** 노드 묶음. 멤버는 노드의 groupId로 정해진다. */
export type NodeGroup = { id: string; title: string };

//텍스트 노드 수정용
export type TextNodeContentPatch = Partial<Pick<TextNode, "title" | "text">>;

export type { DrawingStroke };
