// The 3D view of a MultiBody run (#44): omc's visual shapes in a three.js scene, played back
// against the run's time with a scrubber. Orbit with the left button, pan with the right, zoom on wheel.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  const draw = useRef<(time: number) => void>(() => {});
  const fit = useRef<() => void>(() => {});
  const end = run.t[run.t.length - 1] ?? 0;

  // the scene, once per run
  useEffect(() => {
    const el = host.current;
    if (!el || !run.shapes?.length) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(token("--scene-bg"));
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const grid = new THREE.GridHelper(4, 20, token("--scene-grid"), token("--scene-grid"));
    scene.add(grid, new THREE.AxesHelper(0.3)); // x red, y green, z blue at the world origin

    const meshes = run.shapes.map((s) => {
      const c = s.color.map((v) => (typeof v === "number" ? v : 128) / 255);
      const mesh = new THREE.Mesh(geometry(s.type), new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), roughness: 0.6, transparent: s.type === "spring", opacity: s.type === "spring" ? 0.5 : 1 }));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      return mesh;
    });
    const render = () => renderer.render(scene, camera);
    draw.current = (time: number) => {
      const i = sampleAt(run.t, time);
      const at = (v: Value) => (typeof v === "number" ? v : (run.series[v]?.[i] ?? 0));
      run.shapes!.forEach((s, k) => meshes[k].matrix.fromArray(shapeMatrix(s, at)));
      render();
    };
    fit.current = () => {
      draw.current(0);
      const box = new THREE.Box3();
      meshes.forEach((m) => box.expandByObject(m));
      const centre = box.getCenter(new THREE.Vector3());
      const size = Math.max(0.5, box.getSize(new THREE.Vector3()).length());
      controls.target.copy(centre);
      camera.position.copy(centre).add(new THREE.Vector3(0.6, 0.5, 1).multiplyScalar(size));
      grid.position.y = box.min.y - 0.01;
      controls.update();
    };
    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 200;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const size = new ResizeObserver(resize);
    size.observe(el);
    controls.addEventListener("change", render);
    fit.current();
    resize();
    return () => {
      size.disconnect();
      controls.dispose();
      meshes.forEach((m) => (m.geometry.dispose(), (m.material as THREE.Material).dispose()));
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [run, theme]);

  useEffect(() => draw.current(time), [time, run, theme]);

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
      <div className="viewport3d-scene" ref={host} title="Drag to orbit, right-drag to pan, wheel to zoom, F to frame" />
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
        <button className="key small" title="Frame the scene (F)" onClick={() => fit.current()}>
          frame
        </button>
      </div>
    </section>
  );
}
