"use client";

import {
  Box,
  Expand,
  Layers,
  Loader2,
  Maximize2,
  RotateCw,
  Ruler,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

interface MeshData {
  meta: {
    source: string;
    faceCount: number;
    triangleCount: number;
    componentCount: number;
  };
  bounds: { min: number[]; max: number[] };
  componentCentroids: number[][];
  positions: number[];
  components: number[];
}

/** Model-space (x,y,z) → world (y,z,x): long axis horizontal, blades stacked up. */
const swap = (x: number, y: number, z: number): [number, number, number] => [
  y,
  z,
  x,
];

type ViewKey = "iso" | "front" | "top" | "side";

/** Imperative handle to the running three.js scene, held in a ref. */
interface ThreeApi {
  setAutoRotate: (v: boolean) => void;
  setExplode: (v: boolean) => void;
  setMeasure: (v: boolean) => void;
  setView: (v: ViewKey) => void;
  fit: () => void;
  exportSTL: () => void;
  dispose: () => void;
}

export interface CadViewerHandle {
  exportSTL: () => void;
}

interface CadViewerProps {
  modelUrl?: string;
  modelName?: string;
  /** Called once the scene is ready so a parent can wire external download buttons. */
  onReady?: (handle: CadViewerHandle) => void;
}

export function CadViewer({
  modelUrl = "/models/nova-r-grille.json",
  modelName = "Systemair NOVA-R Linear Grille",
  onReady,
}: CadViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ThreeApi | null>(null);
  // Latest onReady, read inside the one-shot effect without making it a dep
  // (so the scene isn't torn down and rebuilt when the parent re-renders).
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [dims, setDims] = useState<{ l: number; h: number; d: number } | null>(
    null,
  );

  // ── Scene setup (runs once when the tab mounts) ────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let rafId = 0;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 1.6;

    // Lighting tuned for a clean brushed-aluminium look on a light backdrop.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcdd4de, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(1, 1.4, 1.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-1.2, 0.4, -1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdfe6f2, 0.5);
    rim.position.set(0, -1, -0.6);
    scene.add(rim);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Explode targets: each part remembers its outward direction.
    const parts: { mesh: THREE.Mesh; dir: THREE.Vector3 }[] = [];
    let explodeCurrent = 0;
    let explodeTarget = 0;
    let explodeDist = 0;

    // Measurement overlay (bounding box + dimension labels).
    const measureGroup = new THREE.Group();
    measureGroup.visible = false;
    scene.add(measureGroup);

    const material = new THREE.MeshStandardMaterial({
      color: 0xc4cbd4,
      metalness: 0.65,
      roughness: 0.38,
      side: THREE.DoubleSide,
    });

    const boundingSphere = new THREE.Sphere();

    // Assigned to the real implementation once the render loop is set up below;
    // safe to call from setView/fit/the API setters because they only run later.
    let requestRender: () => void = () => {};

    const setView = (v: ViewKey) => {
      const c = controls.target;
      const r = boundingSphere.radius || 500;
      const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.15;
      const dir = {
        iso: new THREE.Vector3(0.45, 0.4, 1),
        front: new THREE.Vector3(0, 0, 1),
        top: new THREE.Vector3(0, 1, 0.001),
        side: new THREE.Vector3(1, 0, 0.001),
      }[v]
        .clone()
        .normalize();
      camera.position.copy(c).addScaledVector(dir, dist);
      camera.near = Math.max(1, dist - r * 2);
      camera.far = dist + r * 4;
      camera.updateProjectionMatrix();
      controls.update();
      requestRender();
    };

    const fit = () => {
      const box = new THREE.Box3().setFromObject(modelGroup);
      box.getBoundingSphere(boundingSphere);
      controls.target.copy(boundingSphere.center);
      setView("iso");
    };

    const makeLabelSprite = (text: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3;
        roundRect(ctx, 4, 4, 248, 56, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 30px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 128, 34);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          depthTest: false,
          transparent: true,
        }),
      );
      return sprite;
    };

    const buildMeasure = (box: THREE.Box3) => {
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
        new THREE.LineBasicMaterial({
          color: 0x2563eb,
          transparent: true,
          opacity: 0.9,
        }),
      );
      edges.position.copy(center);
      measureGroup.add(edges);

      const labelScale = boundingSphere.radius * 0.32;
      const mk = (text: string, pos: THREE.Vector3) => {
        const s = makeLabelSprite(text);
        s.position.copy(pos);
        s.scale.set(labelScale, labelScale * 0.25, 1);
        measureGroup.add(s);
      };
      mk(
        `${Math.round(size.x)} mm`,
        new THREE.Vector3(center.x, box.min.y - size.y * 0.06, box.max.z),
      );
      mk(
        `${Math.round(size.y)} mm`,
        new THREE.Vector3(box.max.x + size.x * 0.04, center.y, box.max.z),
      );
      mk(
        `${Math.round(size.z)} mm`,
        new THREE.Vector3(box.max.x, box.min.y - size.y * 0.06, center.z),
      );

      setDims({
        l: Math.round(size.x),
        h: Math.round(size.y),
        d: Math.round(size.z),
      });
    };

    const buildModel = (data: MeshData) => {
      const { positions, components, componentCentroids } = data;
      const triCount = positions.length / 9;

      // Overall world-space centre (from swapped bounds) so we can recentre.
      const [minx, miny, minz] = swap(
        data.bounds.min[0],
        data.bounds.min[1],
        data.bounds.min[2],
      );
      const [maxx, maxy, maxz] = swap(
        data.bounds.max[0],
        data.bounds.max[1],
        data.bounds.max[2],
      );
      const wMin = new THREE.Vector3(
        Math.min(minx, maxx),
        Math.min(miny, maxy),
        Math.min(minz, maxz),
      );
      const wMax = new THREE.Vector3(
        Math.max(minx, maxx),
        Math.max(miny, maxy),
        Math.max(minz, maxz),
      );
      const center = wMin.clone().add(wMax).multiplyScalar(0.5);

      // Bucket triangles by component into separate geometries (for explode).
      const byComp = new Map<number, number[]>();
      for (let t = 0; t < triCount; t++) {
        const comp = components[t * 3];
        let arr = byComp.get(comp);
        if (!arr) {
          arr = [];
          byComp.set(comp, arr);
        }
        for (let k = 0; k < 9; k += 3) {
          const base = t * 9 + k;
          const [wx, wy, wz] = swap(
            positions[base],
            positions[base + 1],
            positions[base + 2],
          );
          arr.push(wx - center.x, wy - center.y, wz - center.z);
        }
      }

      for (const [comp, verts] of byComp) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(verts, 3),
        );
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        modelGroup.add(mesh);

        const cRaw = componentCentroids[comp] ?? [0, 0, 0];
        const [cx, cy, cz] = swap(cRaw[0], cRaw[1], cRaw[2]);
        const dir = new THREE.Vector3(
          cx - center.x,
          cy - center.y,
          cz - center.z,
        );
        if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
        dir.normalize();
        parts.push({ mesh, dir });
      }

      const box = new THREE.Box3().setFromObject(modelGroup);
      box.getBoundingSphere(boundingSphere);
      explodeDist = boundingSphere.radius * 0.55;
      buildMeasure(box);
      fit();
      // Render synchronously now that geometry + camera are ready. Don't rely
      // on a scheduled frame here: the tab may still be hidden (browsers pause
      // requestAnimationFrame for hidden tabs), and StrictMode remounts make a
      // queued frame racy — a direct draw guarantees the model paints on load.
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
    };

    // Wire up the imperative API used by the React control buttons.
    apiRef.current = {
      setAutoRotate: (v) => {
        controls.autoRotate = v;
        requestRender();
      },
      setExplode: (v) => {
        explodeTarget = v ? 1 : 0;
        requestRender();
      },
      setMeasure: (v) => {
        measureGroup.visible = v;
        requestRender();
      },
      setView,
      fit,
      exportSTL: () => {
        const stl = new STLExporter().parse(modelGroup, { binary: false });
        const slug =
          modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
          "model";
        downloadBlob(new Blob([stl], { type: "model/stl" }), `${slug}.stl`);
      },
      dispose: () => {},
    };
    controls.autoRotate = false;
    onReadyRef.current?.({ exportSTL: () => apiRef.current?.exportSTL() });

    // Load the mesh asset.
    fetch(modelUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: MeshData) => {
        if (disposed) return;
        buildModel(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error("CAD model load failed:", e);
        if (!disposed) {
          setError("Could not load the 3D model.");
          setLoading(false);
        }
      });

    // Keep the renderer sized to its container (also handles the first layout).
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(() => {
      resize();
      requestRender();
    });
    ro.observe(mount);
    resize();

    // Render on demand: draw only while something is actually moving (user
    // interaction, damping, auto-rotate, explode) so the page can go idle.
    let lastTime = 0;
    const renderFrame = (now: number) => {
      rafId = 0;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0.016;
      lastTime = now;
      // Ease the explode factor toward its target.
      const animatingExplode = Math.abs(explodeCurrent - explodeTarget) > 0.001;
      if (animatingExplode) {
        explodeCurrent +=
          (explodeTarget - explodeCurrent) * Math.min(dt * 6, 1);
        for (const p of parts) {
          p.mesh.position
            .copy(p.dir)
            .multiplyScalar(explodeCurrent * explodeDist);
        }
      }
      const cameraMoved = controls.update();
      renderer.render(scene, camera);
      if (cameraMoved || animatingExplode || controls.autoRotate) {
        requestRender();
      }
    };
    requestRender = () => {
      if (!rafId) rafId = requestAnimationFrame(renderFrame);
    };
    controls.addEventListener("change", requestRender);
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      material.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
  }, [modelUrl]);

  // ── Control handlers ───────────────────────────────────────────────────────
  const toggleRotate = useCallback(() => {
    setAutoRotate((v) => {
      apiRef.current?.setAutoRotate(!v);
      return !v;
    });
  }, []);
  const toggleExplode = useCallback(() => {
    setExploded((v) => {
      apiRef.current?.setExplode(!v);
      return !v;
    });
  }, []);
  const toggleMeasure = useCallback(() => {
    setMeasuring((v) => {
      apiRef.current?.setMeasure(!v);
      return !v;
    });
  }, []);
  const fitView = useCallback(() => apiRef.current?.fit(), []);
  const setView = useCallback((v: ViewKey) => apiRef.current?.setView(v), []);
  const fullscreen = useCallback(() => {
    const el = mountRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-card">
      {/* 3D viewport */}
      <div
        className="relative h-[520px] w-full"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 20%, #ffffff 0%, #eef1f6 55%, #dfe4ec 100%)",
        }}
      >
        <div ref={mountRef} className="absolute inset-0" />

        {/* Right-hand control rail (Rotate / Fit / Explode / Measure) */}
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <RailButton
            active={autoRotate}
            icon={RotateCw}
            label="Rotate"
            onClick={toggleRotate}
          />
          <RailButton icon={Expand} label="Fit" onClick={fitView} />
          <RailButton
            active={exploded}
            icon={Layers}
            label="Explode"
            onClick={toggleExplode}
          />
          <RailButton
            active={measuring}
            icon={Ruler}
            label="Measure"
            onClick={toggleMeasure}
          />
        </div>

        {/* Bottom view toolbar */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 px-2 py-1 shadow-lg backdrop-blur">
          <ToolIcon title="Isometric" onClick={() => setView("iso")}>
            <Box className="size-4" />
          </ToolIcon>
          <ToolIcon title="Front" onClick={() => setView("front")}>
            <span className="text-[11px] font-semibold">F</span>
          </ToolIcon>
          <ToolIcon title="Top" onClick={() => setView("top")}>
            <span className="text-[11px] font-semibold">T</span>
          </ToolIcon>
          <ToolIcon title="Side" onClick={() => setView("side")}>
            <span className="text-[11px] font-semibold">S</span>
          </ToolIcon>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <ToolIcon title="Fullscreen" onClick={fullscreen}>
            <Maximize2 className="size-4" />
          </ToolIcon>
        </div>

        {/* Axis gizmo */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10">
          <AxisGizmo />
        </div>

        {/* Measurement readout */}
        {measuring && dims && (
          <div className="absolute left-4 top-4 z-10 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
            <div className="mb-1 font-semibold text-foreground">Dimensions</div>
            <div className="space-y-0.5 text-muted-foreground">
              <div>
                Length:{" "}
                <span className="font-medium text-foreground">{dims.l} mm</span>
              </div>
              <div>
                Height:{" "}
                <span className="font-medium text-foreground">{dims.h} mm</span>
              </div>
              <div>
                Depth:{" "}
                <span className="font-medium text-foreground">{dims.d} mm</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading / error overlays */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Loading 3D model…
            </span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/80">
            <Box className="size-10 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{error}</span>
          </div>
        )}
      </div>

      {/* Caption bar */}
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>{modelName}</span>
        <span className="hidden sm:inline">
          Drag to rotate · scroll to zoom · right-drag to pan
        </span>
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[68px] flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium shadow-sm backdrop-blur transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/90 text-foreground hover:bg-accent"
      }`}
      title={label}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ToolIcon({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </button>
  );
}

function AxisGizmo() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden>
      <title>Axis indicator</title>
      {/* Y (up) */}
      <line x1="18" y1="42" x2="18" y2="14" stroke="#16a34a" strokeWidth="2" />
      <text x="18" y="11" fill="#16a34a" fontSize="9" textAnchor="middle">
        Y
      </text>
      {/* X (right) */}
      <line x1="18" y1="42" x2="46" y2="42" stroke="#dc2626" strokeWidth="2" />
      <text x="50" y="45" fill="#dc2626" fontSize="9" textAnchor="middle">
        X
      </text>
      {/* Z (depth) */}
      <line x1="18" y1="42" x2="34" y2="30" stroke="#2563eb" strokeWidth="2" />
      <text x="40" y="28" fill="#2563eb" fontSize="9" textAnchor="middle">
        Z
      </text>
      <circle cx="18" cy="42" r="2.5" fill="#334155" />
    </svg>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { downloadBlob };
