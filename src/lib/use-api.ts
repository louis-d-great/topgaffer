"use client";

import { useEffect, useState } from "react";

type State<T> = { data: T | null; error: string | null; loading: boolean };

// Shared across screens so switching tabs doesn't refetch the season.
const memo = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let p = memo.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      return body as T;
    });
    p.catch(() => memo.delete(url));
    memo.set(url, p);
  }
  return p;
}

export function useApi<T>(url: string | null): State<T> {
  const [state, setState] = useState<State<T> & { url: string | null }>({
    url,
    data: null,
    error: null,
    loading: url !== null,
  });

  // Reset when the URL changes (adjusting state during render, per React docs).
  if (state.url !== url) {
    setState({ url, data: null, error: null, loading: url !== null });
  }

  useEffect(() => {
    if (!url) return;
    let live = true;
    load<T>(url).then(
      (data) => live && setState({ url, data, error: null, loading: false }),
      (err: Error) => live && setState({ url, data: null, error: err.message, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [url]);

  return state;
}

export function prefetch(url: string) {
  return load(url);
}
