"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Player, Position, SquadPlayer } from "@/lib/fpl/types";
import { FdrPill, TeamBadge } from "./ui";

type Candidate = Player & { fixture: SquadPlayer["fixture"] };

export function PlayerPicker({
  open,
  title,
  players,
  position,
  maxPrice,
  exclude = [],
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  players: Candidate[];
  position?: Position;
  maxPrice?: number;
  exclude?: number[];
  onPick: (p: Candidate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => (!position || p.pos === position) && !exclude.includes(p.id) && p.status !== "u")
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q) || p.team.toLowerCase() === q)
      .sort((a, b) => b.form - a.form || b.totalPoints - a.totalPoints)
      .slice(0, 60);
  }, [players, position, exclude, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="card flex max-h-[85dvh] w-full max-w-lg animate-rise flex-col rounded-b-none sm:rounded-b-[1.25rem]"
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <p className="font-display text-lg font-semibold">{title}</p>
            {maxPrice !== undefined && <p className="text-xs text-muted">Up to £{maxPrice.toFixed(1)}m</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-text" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-ink px-3 focus-within:border-volt/60">
            <Search size={16} className="text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player or team (e.g. ARS)"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-faint"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {list.map((p) => {
            const tooExpensive = maxPrice !== undefined && p.price > maxPrice;
            return (
              <li key={p.id}>
                <button
                  disabled={tooExpensive}
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-fg/5 disabled:opacity-35"
                >
                  <TeamBadge team={p.team} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {p.name}
                      {p.status !== "a" && <span className="ml-1.5 text-xs text-warn">●</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {p.pos} · form <span className="num">{p.form.toFixed(1)}</span> · {p.selectedBy}% owned
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num text-sm font-semibold">£{p.price.toFixed(1)}m</span>
                    {p.fixture && (
                      <span className="flex items-center gap-1 text-[10px] text-muted">
                        {p.fixture.opponent} ({p.fixture.home ? "H" : "A"}) <FdrPill difficulty={p.fixture.difficulty} />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted">No players match.</li>}
        </ul>
      </div>
    </div>
  );
}
