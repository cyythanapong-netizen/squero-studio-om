// The 3D view of a MultiBody run (#44): omc's visual shapes in a three.js scene, played back
// against the run's time with a scrubber. Orbit with the left button, pan with the right, zoom on wheel.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { viewCube } from "@paperboat/shared/viewCube";
import { sampleAt, shapeMatrix, type Shape, type Value } from "./shapes.ts";

export type ShapeRun = { t: number[]; series: Record<string, (number | null)[]>; shapes?: Shape[] };

const SPEEDS = [0.5, 1, 2, 5];

// Unit shapes: x along the length from 0 to 1, y and z centred, size 1 (see shapeMatrix).
const along = (g: THREE.BufferGeometry) => g.rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
function geometry(type: string): THREE.BufferGeometry {
  if (type === "sphere") return new THREE.SphereGeometry(0.5, 24, 16).translate(0.5, 0, 0);
  if (type === "cone") return along(new THREE.ConeGeometry(0.5, 1, 24));
  if (type === "cylinder" || type === "pipecylinder" || type === "pipe" || type === "gearwheel" || type === "spring") return along(new THREE.CylinderGeometry(0.5, 0.5, 1, 24));
  // ponytail: beam and file:// CAD parts draw as their box; load meshes when CAD import lands (#44 §4)
  return new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

export function Viewport3D({ run, theme }: { run: ShapeRun; theme: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [projection, setProjection] = useState<"persp" | "iso">("persp");
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const draw = useRef<(time: number) => void>(() => {});
  const fit = useRef<() => void>(() => {});
  const project = useRef<(p: "persp" | "iso") => void>(() => {});
  const helpers = useRef<{ grid?: THREE.Object3D; axes?: THREE.Object3D }>({});
  const end = run.t[run.t.length - 1] ?? 0;
  // The theme's colours land after React's render (the root's data-theme, or the OS scheme under
  // "system"): rebuild when they actually change, not when the prop does.
  const [look, setLook] = useState(0);
  useEffect(() => {
    const bump = () => setLook((n) => n + 1);
    const seen = new MutationObserver(bump);
    seen.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", bump);
    return () => (seen.disconnect(), scheme.removeEventListener("change", bump));
  }, []);

  // the scene, once per run
  useEffect(() => {
    const el = host.current;
    if (!el || !run.shapes?.length) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClear = false;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(token("--scene-bg"));
    const FOV = 45;
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000);
    const controls = new OrbitControls(camera as THREE.Camera, renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const floor = new THREE.GridHelper(4, 20, token("--scene-grid"), token("--scene-grid"));
    // the world axes: three plain lines from the origin, x red, y green, z blue
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1].reduce<THREE.Vector3[]>((v, _, i, a) => (i % 3 ? v : [...v, new THREE.Vector3(a[i], a[i + 1], a[i + 2])]), [])),
      new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }),
    );
    lines.geometry.setAttribute("color", new THREE.Float32BufferAttribute([0.9, 0.2, 0.2, 0.9, 0.2, 0.2, 0.2, 0.7, 0.2, 0.2, 0.7, 0.2, 0.2, 0.4, 0.9, 0.2, 0.4, 0.9], 3));
    lines.renderOrder = 2;
    floor.visible = grid;
    lines.visible = axes;
    helpers.current = { grid: floor, axes: lines };
    scene.add(floor, lines);

    // the World's own arrows and letters (world.x_arrowLine, world.gravityArrow…): the plain axes stand in
    const shapes = run.shapes.filter((s) => !s.ident.startsWith("world."));
    const meshes = shapes.map((s) => {
      const c = s.color.map((v) => (typeof v === "number" ? v : 128) / 255);
      const mesh = new THREE.Mesh(geometry(s.type), new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), roughness: 0.6, transparent: s.type === "spring", opacity: s.type === "spring" ? 0.5 : 1 }));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      return mesh;
    });
    draw.current = (time: number) => {
      const i = sampleAt(run.t, time);
      const at = (v: Value) => (typeof v === "number" ? v : (run.series[v]?.[i] ?? 0));
      shapes.forEach((s, k) => meshes[k].matrix.fromArray(shapeMatrix(s, at)));
    };
    // ortho frustum half-height: what the perspective camera sees at the target's distance
    const aspect = () => (el.clientWidth || 300) / (el.clientHeight || 200);
    let half = 1;
    const frame = () => {
      if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect();
      else Object.assign(camera, { left: -half * aspect(), right: half * aspect(), top: half, bottom: -half });
      camera.updateProjectionMatrix();
    };
    fit.current = () => {
      draw.current(0);
      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
      const centre = box.getCenter(new THREE.Vector3());
      const size = Math.max(0.5, box.getSize(new THREE.Vector3()).length());
      controls.target.copy(centre);
      camera.position.copy(centre).add(new THREE.Vector3(0.6, 0.5, 1).multiplyScalar(size));
      floor.position.y = box.min.y - 0.01;
      lines.scale.setScalar(size * 0.3);
      half = camera.position.distanceTo(centre) * Math.tan((FOV * Math.PI) / 360);
      camera.zoom = 1;
      frame();
      controls.update();
    };
    project.current = (p) => {
      if ((p === "iso") === camera instanceof THREE.OrthographicCamera) return;
      half = camera.position.distanceTo(controls.target) * Math.tan((FOV * Math.PI) / 360) / camera.zoom;
      const next = p === "iso" ? new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000) : new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000);
      next.position.copy(camera.position);
      next.quaternion.copy(camera.quaternion);
      camera = next;
      controls.object = next;
      frame();
      controls.update();
    };
    fit.current();
    project.current(projection);
    // the cube takes the fitted view as Home
    const cube = viewCube(el, renderer, () => camera, controls, (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      frame();
    });
    resize.observe(el);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.clear();
      renderer.render(scene, camera);
      cube.draw(el.clientWidth, el.clientHeight);
    });
    return () => {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      cube.dispose();
      controls.dispose();
      meshes.forEach((m) => (m.geometry.dispose(), (m.material as THREE.Material).dispose()));
      lines.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      helpers.current = {};
    };
  }, [run, theme, look]); // eslint-disable-line react-hooks/exhaustive-deps -- projection, grid, axes apply below

  useEffect(() => draw.current(time), [time, run, theme, look]);
  useEffect(() => project.current(projection), [projection]);
  useEffect(() => {
    if (helpers.current.grid) helpers.current.grid.visible = grid;
    if (helpers.current.axes) helpers.current.axes.visible = axes;
  }, [grid, axes, run, theme, look]);

  // the clock: simulation time runs at `speed` × wall time
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setTime((t) => {
        const next = t + dt;
        if (next <= end) return next;
        if (loop) return 0;
        setPlaying(false);
        return end;
      });
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, loop, end]);

  if (!run.shapes?.length) return null;
  const step = end / Math.max(1, run.t.length - 1);
  return (
    <section
      className="viewport3d"
      aria-label="3D view"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "f" || e.key === "F") fit.current();
        if (e.key === " ") e.preventDefault(), setPlaying((p) => !p);
      }}
    >
      <div className="viewport3d-bar" role="toolbar" aria-label="Playback">
        <button className="key small" aria-label={playing ? "Pause" : "Play"} onClick={() => (time >= end && setTime(0), setPlaying(!playing))}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button className="key small" aria-label="Step forward" onClick={() => (setPlaying(false), setTime((t) => Math.min(end, t + step)))}>
          ▸|
        </button>
        <input type="range" className="viewport3d-scrub" aria-label="Time" min={0} max={end} step={step || 0.001} value={time} onChange={(e) => (setPlaying(false), setTime(Number(e.target.value)))} />
        <span className="lbl mono">{time.toFixed(2)} s</span>
        <select className="well" aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
        <label className="lbl">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> loop
        </label>
<span className="viewport3d-sep" />
        <button className={`key small${projection === "iso" ? " on" : ""}`} aria-pressed={projection === "iso"} title={projection === "iso" ? "Isometric (parallel) view: click for Perspective" : "Perspective view: click for Isometric (parallel)"} onClick={() => setProjection((p) => (p === "iso" ? "persp" : "iso"))}>
          {projection === "iso" ? "Iso" : "Persp"}
        </button>
        <button className={`key small${grid ? " on" : ""}`} aria-pressed={grid} title="Show or hide the floor grid" onClick={() => setGrid((g) => !g)}>
          grid
        </button>
        <button className={`key small${axes ? " on" : ""}`} aria-pressed={axes} title="Show or hide the world axes (x red, y green, z blue)" onClick={() => setAxes((a) => !a)}>
          axes
        </button>
      </div>
      <div className="viewport3d-scene" ref={host} title="Drag to orbit, right-drag to pan, wheel to zoom, F to frame; the cube turns the view, Home returns" />
    </section>
  );
}
