// Parse 3DFACE entities from a DXF, triangulate, compute connected components,
// and emit a compact mesh JSON for the web viewer.
import fs from "node:fs";

const SRC = process.argv[2];
const OUT = process.argv[3];

const raw = fs.readFileSync(SRC, "latin1");
// DXF is a stream of (groupCode, value) pairs, one per line each.
const lines = raw.split(/\r\n|\r|\n/);
const pairs = [];
for (let i = 0; i + 1 < lines.length; i += 2) {
  const code = parseInt(lines[i].trim(), 10);
  const value = lines[i + 1];
  if (Number.isNaN(code)) continue;
  pairs.push([code, value]);
}

// Walk entities. A 3DFACE has corners at codes 10/20/30, 11/21/31, 12/22/32, 13/23/33.
const faces = []; // each: [ [x,y,z] x4 ]
let i = 0;
while (i < pairs.length) {
  const [code, value] = pairs[i];
  if (code === 0 && value.trim() === "3DFACE") {
    const corners = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    i++;
    while (i < pairs.length && pairs[i][0] !== 0) {
      const [c, v] = pairs[i];
      const f = parseFloat(v);
      if (c === 10) corners[0][0] = f;
      else if (c === 20) corners[0][1] = f;
      else if (c === 30) corners[0][2] = f;
      else if (c === 11) corners[1][0] = f;
      else if (c === 21) corners[1][1] = f;
      else if (c === 31) corners[1][2] = f;
      else if (c === 12) corners[2][0] = f;
      else if (c === 22) corners[2][1] = f;
      else if (c === 32) corners[2][2] = f;
      else if (c === 13) corners[3][0] = f;
      else if (c === 23) corners[3][1] = f;
      else if (c === 33) corners[3][2] = f;
      i++;
    }
    faces.push(corners);
  } else {
    i++;
  }
}

// Build triangles. Each 3DFACE is a quad (v0,v1,v2,v3). If v3≈v2 it's a triangle.
const almostEqual = (a, b) =>
  Math.abs(a[0] - b[0]) < 1e-6 &&
  Math.abs(a[1] - b[1]) < 1e-6 &&
  Math.abs(a[2] - b[2]) < 1e-6;

const tris = []; // each: [ [x,y,z] x3 ]
for (const q of faces) {
  tris.push([q[0], q[1], q[2]]);
  if (!almostEqual(q[3], q[2])) tris.push([q[0], q[2], q[3]]);
}

// ── Connected components via union-find on quantized shared vertices ──────────
const QUANT = 1e-3; // merge vertices closer than 1 micron of the grid
const keyOf = (p) =>
  `${Math.round(p[0] / QUANT)},${Math.round(p[1] / QUANT)},${Math.round(p[2] / QUANT)}`;

const vertId = new Map(); // vertex key -> id
const parent = [];
const find = (x) => {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
};
const union = (a, b) => {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent[ra] = rb;
};
const idFor = (p) => {
  const k = keyOf(p);
  let id = vertId.get(k);
  if (id === undefined) {
    id = parent.length;
    parent.push(id);
    vertId.set(k, id);
  }
  return id;
};

const triVertIds = tris.map((t) => t.map(idFor));
for (const [a, b, c] of triVertIds) {
  union(a, b);
  union(b, c);
}

// Map each triangle to a compact component index.
const rootToComp = new Map();
const triComp = triVertIds.map(([a]) => {
  const r = find(a);
  let comp = rootToComp.get(r);
  if (comp === undefined) {
    comp = rootToComp.size;
    rootToComp.set(r, comp);
  }
  return comp;
});
const componentCount = rootToComp.size;

// ── Bounds & centroid ─────────────────────────────────────────────────────────
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const t of tris)
  for (const p of t)
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }

// Component centroids (for explode direction).
const compSum = Array.from({ length: componentCount }, () => [0, 0, 0, 0]);
tris.forEach((t, ti) => {
  const c = triComp[ti];
  for (const p of t) {
    compSum[c][0] += p[0];
    compSum[c][1] += p[1];
    compSum[c][2] += p[2];
    compSum[c][3] += 1;
  }
});
const compCentroids = compSum.map(([x, y, z, n]) => [x / n, y / n, z / n]);

// ── Emit flat arrays. Round to 3 decimals to keep the file small. ─────────────
const r3 = (v) => Math.round(v * 1000) / 1000;
const positions = [];
const components = []; // one per vertex (3 per triangle) for easy grouping
tris.forEach((t, ti) => {
  for (const p of t) {
    positions.push(r3(p[0]), r3(p[1]), r3(p[2]));
    components.push(triComp[ti]);
  }
});

const out = {
  meta: {
    source: SRC.split(/[\\/]/).pop(),
    faceCount: faces.length,
    triangleCount: tris.length,
    componentCount,
  },
  bounds: { min: min.map(r3), max: max.map(r3) },
  componentCentroids: compCentroids.map((c) => c.map(r3)),
  positions,
  components,
};

fs.mkdirSync(OUT.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  `faces=${faces.length} triangles=${tris.length} components=${componentCount} ` +
    `bytes=${fs.statSync(OUT).size}`,
);
console.log("bounds min", out.bounds.min, "max", out.bounds.max);
// component sizes
const sizes = {};
triComp.forEach((c) => (sizes[c] = (sizes[c] || 0) + 1));
console.log("component tri counts:", JSON.stringify(sizes));
