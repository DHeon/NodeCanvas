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

export type WorkspaceNode = TextNode | ImageNode | CanvasNode | LinkNode;
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
};

//텍스트 노드 수정용
export type TextNodeContentPatch = Partial<Pick<TextNode, "title" | "text">>;
