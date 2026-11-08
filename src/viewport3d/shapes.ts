// A MultiBody shape from omc's _visual.xml (the server's `shapes`) placed at one instant: pure math,
// no three.js, so a node test checks it.

/** A number, or the result variable whose series drives it. */
export type Value = number | string;

export type Shape = {
  ident: string;
  type: string; // box, cylinder, sphere, cone, pipecylinder, beam, gearwheel, spring, file://…
  T: Value[]; // 9, row-major: world → shape frame
  r: Value[]; // 3, frame origin in world
  r_shape: Value[]; // 3, shape origin in the frame
  lengthDir: Value[];
  widthDir: Value[];
  length: Value;
  width: Value;
  height: Value;
  extra: Value;
  color: Value[]; // 0..255
};

type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => {
  const n = Math.hypot(...a);
  return n > 1e-12 ? scale(a, 1 / n) : [0, 0, 0];
};

/**
 * The shape's 4×4 at sample `i`, column-major (three.js `Matrix4.fromArray`): it maps a unit shape
 * (x along the length from 0 to 1, y and z centred, size 1) to world. `at` reads a value at `i`.
 */
export function shapeMatrix(s: Shape, at: (v: Value) => number): number[] {
  const v3 = (a: Value[]): Vec => [at(a[0] ?? 0), at(a[1] ?? 0), at(a[2] ?? 0)];
  const T = s.T.map(at);
  const toWorld = (u: Vec): Vec => [T[0] * u[0] + T[3] * u[1] + T[6] * u[2], T[1] * u[0] + T[4] * u[1] + T[7] * u[2], T[2] * u[0] + T[5] * u[1] + T[8] * u[2]];
  const ex = unit(v3(s.lengthDir));
  let ey = unit(sub(v3(s.widthDir), scale(ex, dot(v3(s.widthDir), ex))));
  if (!Math.hypot(...ey)) ey = unit(cross(ex, Math.abs(ex[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const ez = cross(ex, ey);
  const [X, Y, Z] = [toWorld(scale(ex, at(s.length))), toWorld(scale(ey, at(s.width))), toWorld(scale(ez, at(s.height)))];
  const r = v3(s.r);
  const p = toWorld(v3(s.r_shape));
  return [...X, 0, ...Y, 0, ...Z, 0, r[0] + p[0], r[1] + p[1], r[2] + p[2], 1];
}

// ponytail: the sample at or before `time`, no interpolation; 500 samples a run look smooth enough
export function sampleAt(t: number[], time: number): number {
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
