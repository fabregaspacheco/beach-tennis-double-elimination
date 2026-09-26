import { useLayoutEffect, useState, type RefObject } from 'react';
import type { Match } from '../types';
import { isByeMatch } from '../bracket/helpers';

interface BracketConnectorsProps {
  /** The `.bracket-columns` element these matches are rendered inside. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Every match belonging to this one bracket tree (e.g. all `upper` matches). Connectors are
   *  only drawn between two matches that are both in this list — a match whose winner goes
   *  elsewhere (the upper bracket final going to the Grand Final, say) is simply skipped. */
  matches: Match[];
}

interface Connector {
  linePath: string;
  arrowPath: string;
  /** True when the source match is a BYE — the team on the other end advanced for free rather
   *  than winning a real match, so the connector reads as dashed instead of solid. */
  bye: boolean;
}

const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 4;

/**
 * Draws an arrow from each match to whichever match its winner advances to, so the flow through
 * the bracket reads at a glance. Positions are measured from the real rendered DOM (via
 * `data-match-id` on each MatchCard) rather than computed from the CSS layout, so this stays
 * correct regardless of exact card sizes or gaps.
 *
 * The arrowhead is drawn as its own filled triangle `<path>` rather than an SVG `<marker>` —
 * html-to-image (used for the "share snapshot" export) doesn't rasterize markers correctly, so
 * they'd render fine on screen but come out as a distorted blob in the exported image. Every
 * connector always ends in a rightward horizontal segment, so the arrow orientation never varies.
 */
export function BracketConnectors({ containerRef, matches }: BracketConnectorsProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      const next: Connector[] = [];
      // Every card's box, relative to the container — used to keep a connector that skips over a
      // whole column from running through a card sitting in that column.
      const cards = Array.from(containerEl.querySelectorAll<HTMLElement>('[data-match-id]')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - containerRect.left,
          right: r.right - containerRect.left,
          top: r.top - containerRect.top,
          bottom: r.bottom - containerRect.top,
        };
      });

      for (const m of matches) {
        if (!m.nextMatchWinner) continue;
        const target = matches.find((x) => x.id === m.nextMatchWinner!.matchId);
        if (!target) continue;
        const srcEl = containerEl.querySelector<HTMLElement>(`[data-match-id="${m.id}"]`);
        const tgtEl = containerEl.querySelector<HTMLElement>(`[data-match-id="${target.id}"]`);
        if (!srcEl || !tgtEl) continue;

        const s = srcEl.getBoundingClientRect();
        const t = tgtEl.getBoundingClientRect();
        const x1 = s.right - containerRect.left;
        const y1 = s.top + s.height / 2 - containerRect.top;
        const x2 = t.left - containerRect.left;
        const y2 = t.top + t.height / 2 - containerRect.top;
        const midX = x1 + (x2 - x1) / 2;
        const tipX = x2 - 2;

        // The next column to the right of the source; a target further than that means this
        // connector skips over at least one whole column (e.g. an upper-bracket loser's winner
        // dropping past a round).
        const nextColumnLeft = Math.min(...cards.map((c) => c.left).filter((l) => l > x1 + 1));
        const skipsColumn = x2 > nextColumnLeft + 1;
        const blockedAt = (y: number) =>
          cards.some((c) => c.left >= nextColumnLeft - 1 && c.left < x2 - 1 && y > c.top - 4 && y < c.bottom + 4);

        let linePath: string;
        if (skipsColumn && !blockedAt(y2)) {
          // Leave the source, drop straight down in the gap next to it, then run along the target's
          // own height — that row is empty in the skipped column, unlike the source's, which
          // usually lines up with a card there and reads as if it fed that card instead.
          const dropX = x1 + 4;
          linePath = `M ${x1} ${y1} L ${dropX} ${y1} L ${dropX} ${y2} L ${tipX - ARROW_LENGTH} ${y2}`;
        } else if (skipsColumn && !blockedAt(y1)) {
          const dropX = x2 - 10;
          linePath = `M ${x1} ${y1} L ${dropX} ${y1} L ${dropX} ${y2} L ${tipX - ARROW_LENGTH} ${y2}`;
        } else if (y1 === y2) {
          linePath = `M ${x1} ${y1} L ${tipX - ARROW_LENGTH} ${y2}`;
        } else {
          linePath = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${tipX - ARROW_LENGTH} ${y2}`;
        }
        const arrowPath = `M ${tipX} ${y2} L ${tipX - ARROW_LENGTH} ${y2 - ARROW_HALF_WIDTH} L ${tipX - ARROW_LENGTH} ${y2 + ARROW_HALF_WIDTH} Z`;

        // A lower-bracket `byeSlot` match is a guaranteed BYE from the moment the bracket is
        // drawn, even before it actually resolves (`isByeMatch` only turns true once its one live
        // side is fed) — MatchCard already shows it as a BYE card immediately for the same reason,
        // so the connector leading out of it should read as dashed from the start too.
        next.push({ linePath, arrowPath, bye: isByeMatch(m) || Boolean(m.byeSlot) });
      }

      setSize({ width: containerRect.width, height: containerRect.height });
      setConnectors(next);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, matches]);

  if (size.width === 0) return null;

  return (
    <svg className="bracket-connectors" width={size.width} height={size.height} aria-hidden="true">
      {/* fill/stroke are set as plain SVG attributes, not CSS classes: html-to-image (used by the
          "share snapshot" export) doesn't reliably inline class-based styles onto SVG elements
          when it serializes the page, so a className-only line here would render fine on screen
          but turn into a solid black blob in the exported image. */}
      {connectors.map((c, i) => (
        <g key={i}>
          <path
            d={c.linePath}
            fill="none"
            stroke={c.bye ? '#c2b8a3' : '#9c8f72'}
            strokeWidth={1.5}
            strokeDasharray={c.bye ? '5 4' : undefined}
          />
          <path d={c.arrowPath} fill={c.bye ? '#c2b8a3' : '#9c8f72'} stroke="none" />
        </g>
      ))}
    </svg>
  );
}
