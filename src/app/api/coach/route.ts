import type { NextRequest } from "next/server";
import { coachAnswer, type ChatTurn } from "@/lib/coach";

const MAX_TURNS = 10;
const MAX_CHARS = 1000;
// The free Gemini tier has tight quotas: cap questions per team.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
const recent = new Map<number, number[]>();

/**
 * Body: { teamId, messages: [{ role: "user" | "coach", text }], experts: [{ id, name }] }
 * Streams newline-delimited JSON events (memories, model, text deltas, done).
 */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { teamId?: unknown; messages?: unknown; experts?: unknown } | null;
  const teamId = Number(b?.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) return Response.json({ error: "Invalid team ID" }, { status: 400 });

  const messages: ChatTurn[] = (Array.isArray(b?.messages) ? b.messages : [])
    .filter((m): m is ChatTurn => !!m && (m.role === "user" || m.role === "coach") && typeof m.text === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
  if (messages.at(-1)?.role !== "user" || !messages.at(-1)!.text.trim()) {
    return Response.json({ error: "Ask a question first" }, { status: 400 });
  }
  const experts = (Array.isArray(b?.experts) ? b.experts : [])
    .filter((e): e is { id: number; name: string } => !!e && Number.isInteger(e.id) && e.id > 0 && typeof e.name === "string")
    .slice(0, 10)
    .map((e) => ({ id: e.id, name: e.name.slice(0, 60) }));

  const now = Date.now();
  const times = (recent.get(teamId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    return Response.json({ error: "You've asked a lot in a short time. Try again in a few minutes." }, { status: 429 });
  }
  recent.set(teamId, [...times, now]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of coachAnswer(teamId, messages, experts)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        console.error(err);
        controller.enqueue(encoder.encode(JSON.stringify({ type: "fallback", reason: "Couldn't load your FPL data." }) + "\n"));
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
