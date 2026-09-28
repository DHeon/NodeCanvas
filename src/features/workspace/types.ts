export type Point = {
  x: number;
  y: number;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type TextNode = {
  id: string;
  type: "text_node";
  position: Point;
  width: number;
  height: number;
  title: string;
  text: string;
};

export type WorkspaceDocument = {
  canvas: {
    width: number;
    height: number;
  };
  nodes: TextNode[];
};

export type TextNodeContentPatch = Partial<
  Pick<TextNode, "title" | "text">
>;