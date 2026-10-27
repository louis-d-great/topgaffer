import { Suspense, type ReactNode } from "react";

// Expert IDs are only known at request time (any FPL team can be tracked), so the page reads its
// param inside a Suspense boundary.
export default function ExpertLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
