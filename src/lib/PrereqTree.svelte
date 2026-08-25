<script lang="ts">
  import { buildPrereqGraph } from "./prereqGraph";
  import type { GraphNode, PrereqGraphResult } from "./prereqGraph";
  import { t } from "./i18n.svelte";

  let {
    code,
    prereqMap,
    isCompleted,
    onclose,
  }: {
    code: string;
    prereqMap: Record<string, { prereqs: string[] }> | null;
    isCompleted: (code: string) => boolean;
    onclose: () => void;
  } = $props();

  const graph: PrereqGraphResult = $derived(buildPrereqGraph(code, prereqMap, isCompleted, 3));

  // Layout: layered columns by depth, rows stacked within a column.
  const NODE_W = 96;
  const NODE_H = 30;
  const COL_GAP = 56;
  const ROW_GAP = 10;

  const layout = $derived.by(() => {
    const byDepth = new Map<number, GraphNode[]>();
    for (const n of graph.nodes) {
      let col = byDepth.get(n.depth);
      if (!col) {
        col = [];
        byDepth.set(n.depth, col);
      }
      col.push(n);
    }
    const depths = [...byDepth.keys()].sort((a, b) => a - b);
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    depths.forEach((depth, colIdx) => {
      const col = byDepth.get(depth)!;
      maxRows = Math.max(maxRows, col.length);
      col.forEach((n, rowIdx) => {
        pos.set(n.code, {
          x: colIdx * (NODE_W + COL_GAP),
          y: rowIdx * (NODE_H + ROW_GAP),
        });
      });
    });
    const width = Math.max(depths.length, 1) * (NODE_W + COL_GAP) - COL_GAP;
    const height = maxRows * (NODE_H + ROW_GAP) - ROW_GAP;
    return { pos, width: Math.max(width, NODE_W), height: Math.max(height, NODE_H) };
  });

  function nodeFill(n: GraphNode): string {
    if (n.depth === 0) return n.completed ? "#16a34a" : "#2563eb";
    return n.completed ? "#86efac" : "#fde68a";
  }
</script>

<div class="mt-1 border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 p-2 overflow-x-auto">
  <div class="flex items-center justify-between mb-1">
    <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t("course.prereqTree")}</span>
    <button
      type="button"
      class="text-xs cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      onclick={onclose}
    >✕</button>
  </div>
  <svg
    width={layout.width}
    height={layout.height}
    viewBox="0 0 {layout.width} {layout.height}"
    role="img"
    aria-label="{t('course.prereqTree')}: {code}"
  >
    {#each graph.edges as edge (edge.from + ">" + edge.to)}
      {@const a = layout.pos.get(edge.from)}
      {@const b = layout.pos.get(edge.to)}
      {#if a && b}
        <line
          x1={a.x + NODE_W} y1={a.y + NODE_H / 2}
          x2={b.x} y2={b.y + NODE_H / 2}
          stroke="#a1a1aa" stroke-width="1.5"
        />
      {/if}
    {/each}
    {#each graph.nodes as n (n.code)}
      {@const p = layout.pos.get(n.code)}
      {#if p}
        <g role="listitem" aria-label={n.code}>
          <rect
            x={p.x} y={p.y} width={NODE_W} height={NODE_H}
            fill={nodeFill(n)} stroke="#71717a" stroke-width="1" rx="4"
          />
          <text
            x={p.x + NODE_W / 2} y={p.y + NODE_H / 2 + 4}
            text-anchor="middle"
            font-size="11"
            font-family="ui-sans-serif, system-ui, sans-serif"
            fill={n.completed ? "#14532d" : "#27272a"}
          >{n.code}</text>
        </g>
      {/if}
    {/each}
  </svg>
</div>
