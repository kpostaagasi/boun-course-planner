// Pure prerequisite-graph builder for the SVG DAG view.
// Dependency-free so node:test can cover it directly (project pattern:
// pure logic in .mjs, Svelte wrappers re-export with types).

/**
 * @typedef {Object} PrereqInfo
 * @property {string[]} prereqs
 */

/**
 * @typedef {Object} GraphNode
 * @property {string} code
 * @property {number} depth      0 = root course, up to maxDepth
 * @property {boolean} completed
 * @property {boolean} missing
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} from  prerequisite course code
 * @property {string} to    dependent course code
 */

/**
 * @typedef {Object} PrereqGraph
 * @property {GraphNode[]} nodes
 * @property {GraphEdge[]} edges
 */

/**
 * Build a layered prereq graph rooted at `root`, expanding prerequisites
 * up to `maxDepth` levels below the root (root = depth 0). Dangling prereq
 * references (absent from the map) are still emitted as leaf nodes so users
 * see what's required, but are not expanded. Cycles are broken by never
 * revisiting a code already seen.
 *
 * @param {string} root base course code, e.g. "CMPE210"
 * @param {Record<string, PrereqInfo> | null} prereqs full prereq map
 * @param {(code: string) => boolean} isCompleted predicate for green highlighting
 * @param {number} [maxDepth=3]
 * @returns {PrereqGraph}
 */
export function buildPrereqGraph(root, prereqs, isCompleted, maxDepth = 3) {
  if (!prereqs || !prereqs[root]) {
    return { nodes: [], edges: [] };
  }

  /** @type {Map<string, GraphNode>} */
  const nodes = new Map();
  /** @type {GraphEdge[]} */
  const edges = [];

  let frontier = [root];
  /** @type {Set<string>} */
  const seen = new Set(frontier);

  for (let depth = 0; ; depth++) {
    for (const code of frontier) {
      nodes.set(code, {
        code,
        depth,
        completed: !!isCompleted(code),
        missing: !isCompleted(code),
      });
    }
    if (depth === maxDepth) break;

    /** @type {string[]} */
    const next = [];
    for (const code of frontier) {
      const entry = prereqs[code];
      if (!entry) continue; // dangling reference: leaf node, not expanded
      for (const pre of entry.prereqs || []) {
        edges.push({ from: pre, to: code });
        if (!seen.has(pre)) {
          seen.add(pre);
          next.push(pre);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) {
      // Nothing left to expand; remaining frontier nodes already recorded.
      break;
    }
  }

  return {
    nodes: [...nodes.values()].sort(
      (a, b) => a.depth - b.depth || a.code.localeCompare(b.code),
    ),
    edges,
  };
}
