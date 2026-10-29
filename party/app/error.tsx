"use client";
import { useEffect, useState } from "react";

/* Something threw while rendering (29 Oct). Once: reload, since most of these are a stale page or a
   half-loaded chunk after a deploy. If it throws again on the fresh page, say so and give a way out:
   the TV restores the night from this laptop, a phone takes its seat back. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [again, setAgain] = useState(false);
  useEffect(() => {
    let seen = "";
    try { seen = sessionStorage.getItem("qmb.crashed") || ""; } catch { /* no storage: just show the card */ }
    if (seen !== location.pathname) {
      try { sessionStorage.setItem("qmb.crashed", location.pathname); } catch { /* ignore */ }
      location.reload();
    } else setAgain(true);
  }, []);
  if (!again) return null;
  return (
    <main className="min-h-dvh grid place-items-center p-6 text-center">
      <div className="card max-w-[420px] flex flex-col gap-3">
        <div className="display text-40" style={{ color: "var(--color-gold)" }}>Something broke</div>
        <p className="text-15 text-[var(--color-ink-2)]">The page hit an error twice. Reloading usually fixes it: the TV picks the night back up from this device, and a phone takes its seat back.</p>
        <p className="text-12 text-[var(--color-ink-3)] break-words">{error.message}{error.digest ? ` (${error.digest})` : ""}</p>
        <button className="btn btn-gold" onClick={() => { try { sessionStorage.removeItem("qmb.crashed"); } catch { /* ignore */ } location.reload(); }}>Reload</button>
        <button className="btn btn-sm btn-ghost" onClick={() => { try { sessionStorage.removeItem("qmb.crashed"); } catch { /* ignore */ } reset(); }}>Try again without reloading</button>
        <button className="text-14 underline underline-offset-4 text-[var(--color-ink-2)]" onClick={() => { try { sessionStorage.removeItem("qmb.crashed"); } catch { /* ignore */ } location.assign("/"); }}>Home screen</button>
      </div>
    </main>);
}
