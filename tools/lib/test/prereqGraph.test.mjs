import test from "node:test";
import assert from "node:assert/strict";
import { buildPrereqGraph } from "../../../src/lib/prereqGraph.mjs";

const prereqs = {
  CMPE300: { prereqs: ["CMPE210", "MATH202"] },
  CMPE210: { prereqs: ["CMPE150"] },
  CMPE150: { prereqs: [] },
  MATH202: { prereqs: [] },
  SOC999: { prereqs: ["DANGLING101"] }, // dangling reference
  CYCLE_A: { prereqs: ["CYCLE_B"] },
  CYCLE_B: { prereqs: ["CYCLE_A"] },
};

test("returns empty graph when root missing from map", () => {
  assert.deepEqual(buildPrereqGraph("NOPE", prereqs, () => false), { nodes: [], edges: [] });
});

test("returns empty graph when map is null", () => {
  assert.deepEqual(buildPrereqGraph("CMPE210", null, () => false), { nodes: [], edges: [] });
});

test("root-only course has one node, no edges", () => {
  const g = buildPrereqGraph("CMPE150", prereqs, () => false);
  assert.equal(g.nodes.length, 1);
  assert.equal(g.nodes[0].depth, 0);
  assert.deepEqual(g.edges, []);
});

test("expands two levels with correct depths", () => {
  const g = buildPrereqGraph("CMPE300", prereqs, () => false, 3);
  const byCode = Object.fromEntries(g.nodes.map((n) => [n.code, n]));
  assert.equal(byCode.CMPE300.depth, 0);
  assert.equal(byCode.CMPE210.depth, 1);
  assert.equal(byCode.MATH202.depth, 1);
  assert.equal(byCode.CMPE150.depth, 2);
  assert.equal(g.edges.length, 3); // 210->300, MATH202->300, 150->210
});

test("depth limit stops expansion at maxDepth", () => {
  const g = buildPrereqGraph("CMPE300", prereqs, () => false, 1);
  const codes = g.nodes.map((n) => n.code).sort();
  assert.deepEqual(codes, ["CMPE210", "CMPE300", "MATH202"]); // no CMPE150
});

test("completed flag set from predicate", () => {
  const g = buildPrereqGraph("CMPE300", prereqs, (c) => c === "CMPE150");
  const cmpe150 = g.nodes.find((n) => n.code === "CMPE150");
  assert.equal(cmpe150.completed, true);
  const root = g.nodes.find((n) => n.code === "CMPE300");
  assert.equal(root.completed, false);
});

test("dangling prereq appears as leaf node but is not expanded", () => {
  const g = buildPrereqGraph("SOC999", prereqs, () => false, 3);
  const codes = g.nodes.map((n) => n.code).sort();
  assert.deepEqual(codes, ["DANGLING101", "SOC999"]);
  assert.deepEqual(g.edges, [{ from: "DANGLING101", to: "SOC999" }]);
});

test("cycles terminate without hanging", () => {
  const g = buildPrereqGraph("CYCLE_A", prereqs, () => false, 5);
  const codes = g.nodes.map((n) => n.code).sort();
  assert.deepEqual(codes, ["CYCLE_A", "CYCLE_B"]);
});

test("shared prereq across branches is not duplicated", () => {
  const shared = {
    X: { prereqs: ["S", "A"] },
    A: { prereqs: ["S"] },
    S: { prereqs: [] },
  };
  const g = buildPrereqGraph("X", shared, () => false, 3);
  const sNodes = g.nodes.filter((n) => n.code === "S");
  assert.equal(sNodes.length, 1);
  // Both edges into S exist even though node appears once.
  assert.equal(g.edges.filter((e) => e.from === "S").length, 2);
});
