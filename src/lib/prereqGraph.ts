export { buildPrereqGraph } from "./prereqGraph.mjs";

export type GraphNode = {
  code: string;
  depth: number;
  completed: boolean;
  missing: boolean;
};

export type GraphEdge = { from: string; to: string };

export type PrereqGraphResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
