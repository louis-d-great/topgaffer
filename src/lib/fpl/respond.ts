import "server-only";
import { FplError } from "./api";

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function respond<T>(work: () => Promise<T | null>, notFound = "Not found") {
  try {
    const data = await work();
    if (data === null) return Response.json({ error: notFound }, { status: 404 });
    return Response.json(data);
  } catch (err) {
    if (err instanceof FplError && err.status === 404) {
      return Response.json({ error: notFound }, { status: 404 });
    }
    console.error(err);
    return Response.json({ error: "FPL is not responding. Try again in a minute." }, { status: 502 });
  }
}
