"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { Position } from "@/lib/fpl/types";

// Primary (body) / secondary (sleeves, collar) colours per club.
export const KITS: Record<string, [string, string]> = {
  ARS: ["#EF0107", "#ffffff"],
  AVL: ["#670E36", "#95BFE5"],
  BOU: ["#DA291C", "#111111"],
  BRE: ["#E30613", "#ffffff"],
  BHA: ["#0057B8", "#ffffff"],
  CHE: ["#034694", "#ffffff"],
  COV: ["#59CBE8", "#ffffff"],
  CRY: ["#1B458F", "#C4122E"],
  EVE: ["#003399", "#ffffff"],
  FUL: ["#f4f4f4", "#111111"],
  HUL: ["#F5A12D", "#111111"],
  IPS: ["#0044A9", "#ffffff"],
  LEE: ["#f4f4f4", "#1D428A"],
  LIV: ["#C8102E", "#F6EB61"],
  MCI: ["#6CABDD", "#ffffff"],
  MUN: ["#DA291C", "#111111"],
  NEW: ["#241F20", "#ffffff"],
  NFO: ["#DD0000", "#ffffff"],
  TOT: ["#f4f4f4", "#132257"],
  SUN: ["#EB172B", "#ffffff"],
};

// Goalkeepers wear a distinct shirt, as in FPL.
const KEEPER: [string, string] = ["#22c55e", "#0b3d1d"];

/**
 * The club's official shirt from FPL's own image server (goalkeepers get their keeper kit).
 * Falls back to a drawn shirt in the club colours if the image can't load.
 */
export function Jersey({ team, code, pos, size = 48 }: { team: string; code?: number; pos?: Position; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (code && !failed) {
    return (
      <Image
        src={`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}${pos === "GKP" ? "_1" : ""}-110.png`}
        alt=""
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(true)}
        className="object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return <DrawnJersey team={team} pos={pos} size={size} />;
}

function DrawnJersey({ team, pos, size }: { team: string; pos?: Position; size: number }) {
  const [body, trim] = pos === "GKP" ? KEEPER : (KITS[team] ?? ["#3a444b", "#cfd6d2"]);
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]">
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {/* sleeves */}
      <path d="M18 9 L4 19 L10 31 L18 27 Z" fill={trim} />
      <path d="M46 9 L60 19 L54 31 L46 27 Z" fill={trim} />
      {/* body */}
      <path d="M18 9 Q25 6 26 6 Q32 11 38 6 Q39 6 46 9 L46 58 Q32 61 18 58 Z" fill={body} />
      {/* collar */}
      <path d="M26 6 Q32 13 38 6" fill="none" stroke={trim} strokeWidth="2.6" strokeLinecap="round" />
      {/* light and edge */}
      <path d="M18 9 Q25 6 26 6 Q32 11 38 6 Q39 6 46 9 L60 19 L54 31 L46 27 L46 58 Q32 61 18 58 L18 27 L10 31 L4 19 Z" fill={`url(#${id}-shade)`} />
      <path
        d="M18 9 Q25 6 26 6 Q32 11 38 6 Q39 6 46 9 L60 19 L54 31 L46 27 L46 58 Q32 61 18 58 L18 27 L10 31 L4 19 Z"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1"
      />
    </svg>
  );
}

/** FPL's own fixture difficulty colours, so the scale reads the way FPL players already know it. */
export const FDR: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#375523", fg: "#ffffff" },
  2: { bg: "#01fc7a", fg: "#062014" },
  3: { bg: "#e7e7e7", fg: "#1a1a1a" },
  4: { bg: "#ff1751", fg: "#ffffff" },
  5: { bg: "#80072d", fg: "#ffffff" },
};

export function FixtureChip({ fixture }: { fixture: { opponent: string; home: boolean; difficulty: number } | null }) {
  if (!fixture) return <span className="mt-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-faint">No game</span>;
  const c = FDR[fixture.difficulty] ?? FDR[3];
  return (
    <span
      className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
      style={{ background: c.bg, color: c.fg }}
      title={`Fixture difficulty ${fixture.difficulty} of 5`}
    >
      {fixture.opponent} ({fixture.home ? "H" : "A"})
    </span>
  );
}
