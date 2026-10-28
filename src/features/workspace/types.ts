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

//텍스트 노드 데이터들
export type TextNode = {
  id: string;
  type: "text_node";
  position: Point;
  width: number;
  height: number;
  title: string;
  text: string;
};

export type ConnectionSide = "top" | "right" | "bottom" | "left";

export type ConnectionEndpoint = {
  nodeId: string;
  side: ConnectionSide;
};

export type NodeConnection = {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
};

//캔버스 데이터
export type WorkspaceDocument = {
  canvas: {
    width: number;
    height: number;
  };
  nodes: TextNode[];
  connections: NodeConnection[];
};

//텍스트 노드 수정용
export type TextNodeContentPatch = Partial<Pick<TextNode, "title" | "text">>;
