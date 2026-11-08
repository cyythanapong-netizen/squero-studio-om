// Where a part and its ports sit on the canvas, in px. A placement is the centre of the plate;
// a port sits on the plate's edge, `at` percent along it.

import { plateSize } from "@paperboat/shared";
import type { ComponentInst } from "../model/types.ts";
import { rotateIcon } from "./rotate.ts";

const PLAIN = { g: [] };

/** The part's icon as placed (turned and mirrored). */
export const placedIcon = (part: ComponentInst) => rotateIcon(part.icon ?? PLAIN, part.placement);

export const plateOf = (part: ComponentInst) => plateSize(placedIcon(part));

/** The plate's top-left, where the canvas puts the node. */
export function topLeft(part: ComponentInst): [number, number] {
  const { w, h } = plateOf(part);
  return [part.placement.x - w / 2, part.placement.y - h / 2];
}

/** The plate centre for a node dragged to `position`. */
export function centreFor(part: ComponentInst, position: { x: number; y: number }): [number, number] {
  const { w, h } = plateOf(part);
  return [position.x + w / 2, position.y + h / 2];
}
