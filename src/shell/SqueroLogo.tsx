/**
 * The Squero Studio logo (squero#42): W3 Water wordmark with the B3 Mono product badge.
 * Rendered as an inline SVG derived from module m = 13px (Geist 600 stem width at 100px).
 */

import {
  SQUERO_LOGO_VIEWBOX,
  WATER_DOTS,
  WATER_Y,
  DOT_SIZE,
  BADGE_GEOMETRY,
  type SqueroLogoProps,
  logoWidth,
} from "./logo.ts";

export {
  SQUERO_LOGO_VIEWBOX,
  WATER_DOTS,
  WATER_Y,
  DOT_SIZE,
  BADGE_GEOMETRY,
  type SqueroLogoProps,
  logoWidth,
};

export function SqueroLogo({ product = "OM", height = 20, running = false }: SqueroLogoProps) {
  const width = logoWidth(height);
  const cls = running ? "logo-live" : "logo-idle";

  return (
    <svg
      className={`squero-logo ${cls}`}
      width={width}
      height={height}
      viewBox={`${SQUERO_LOGO_VIEWBOX.x} ${SQUERO_LOGO_VIEWBOX.y} ${SQUERO_LOGO_VIEWBOX.width} ${SQUERO_LOGO_VIEWBOX.height}`}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
      style={{ ["--lr" as any]: `${DOT_SIZE}px` }}
    >
      <text
        x={0}
        y={0}
        className="squero-logo-ink"
        fontFamily="var(--font-sans)"
        fontWeight={600}
        fontSize={100}
      >
        squero
      </text>
      <text
        x={358.2}
        y={0}
        className="squero-logo-muted"
        fontFamily="var(--font-sans)"
        fontWeight={400}
        fontSize={100}
      >
        studio
      </text>
      <g className="squero-logo-water" shapeRendering="crispEdges">
        {WATER_DOTS.map((x, i) => (
          <g key={i} className={`w w${i + 1}`}>
            <rect x={x} y={WATER_Y} width={DOT_SIZE} height={DOT_SIZE} />
          </g>
        ))}
      </g>
      <g transform={`translate(${BADGE_GEOMETRY.x} ${BADGE_GEOMETRY.y})`}>
        <rect
          width={BADGE_GEOMETRY.size}
          height={BADGE_GEOMETRY.size}
          rx={BADGE_GEOMETRY.radius}
          className="squero-logo-tile"
        />
        <text
          x={BADGE_GEOMETRY.codeX}
          y={BADGE_GEOMETRY.codeY}
          className="squero-logo-code"
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fontSize={BADGE_GEOMETRY.codeFontSize}
        >
          {product}
        </text>
      </g>
    </svg>
  );
}
