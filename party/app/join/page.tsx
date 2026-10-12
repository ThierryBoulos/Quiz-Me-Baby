"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FacePicker } from "@/components/Face";
import { FACES } from "@/lib/faces";
import { cleanCode } from "@/lib/room";
import { ensureSession, rpc } from "@/lib/supabase";

/* JOIN — SNAKED's one screen: room code, name, a face, "Take my seat".
   Errors sit beside the thing that's wrong; a taken name offers a fix. */
function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(cleanCode(params.get("code") ?? ""));
  const [name, setName] = useState("");
  const [face, setFace] = useState(FACES[0]);
  const [taken, setTaken] = useState<string[]>([]);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTaken = useCallback(async () => {
    if (code.length !== 4) { setTaken([]); return; }
    try { await ensureSession(); setTaken(await rpc<string[]>("qmb_taken_faces", { r: code })); } catch { setTaken([]); }
  }, [code]);
  useEffect(() => { void loadTaken(); }, [loadTaken]);
  /* don't sit on a face somebody already has */
  useEffect(() => { if (taken.includes(face)) setFace(FACES.find((f) => !taken.includes(f)) || face); }, [taken, face]);

  async function join(useName: string) {
    setBusy(true); setErr(null); setCodeErr(null);
    try {
      await ensureSession();
      const res = await rpc<{ ok?: boolean; error?: string; suggestion?: string }>("qmb_join", { r: code, nm: useName.trim(), face });
      if (res.error === "no_room") { setCodeErr("Room not found"); setBusy(false); return; }
      if (res.error === "name_taken") { setSuggest(res.suggestion ?? null); setBusy(false); return; }
      if (res.error === "face_taken") { setErr("Someone already took that face — pick another."); void loadTaken(); setBusy(false); return; }
      if (res.error) { setErr("Couldn't join: " + res.error); setBusy(false); return; }
      router.push("/room/" + code);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  const ready = code.length === 4 && name.trim().length > 0;

  return (
    <main className="screen justify-between" onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) void join(name); }}>
      <div className="flex items-center justify-between">
        <a href="/" className="text-[var(--color-ink-3)] text-[14px] font-bold">← Back</a>
        <div className="eyebrow">Join a game</div>
        <span className="w-10" />
      </div>
      <div>
        <div className="flex items-baseline justify-between min-h-[18px]">
          <label className="field-label !mb-0" htmlFor="room-code">Room code</label>
          {codeErr && <span className="field-error">{codeErr}</span>}
        </div>
        <div className="h-2" />
        <input id="room-code" className="input input-code" value={code} placeholder="Enter 4-letter code" autoComplete="off"
          autoCapitalize="characters" autoFocus={code.length === 0}
          onChange={(e) => { setCode(cleanCode(e.target.value)); setCodeErr(null); }} />
      </div>
      <div>
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" className="input" value={name} maxLength={12} placeholder="Enter your name" autoComplete="off"
          autoFocus={code.length === 4} onChange={(e) => { setName(e.target.value); setSuggest(null); }} />
      </div>
      <div>
        <div className="field-label">Pick a face</div>
        <FacePicker value={face} taken={taken} onPick={setFace} />
      </div>
      {suggest && (
        <button disabled={busy} onClick={() => { setName(suggest); void join(suggest); }}
          className="flex items-center gap-3 w-full text-left rounded-[18px] px-4 py-3.5"
          style={{ background: "rgba(245,197,24,.09)", border: "1px solid rgba(245,197,24,.4)" }}>
          <span className="text-[20px]" aria-hidden>↩</span>
          <span className="flex-1 text-[14.5px] font-bold">
            <span className="text-[var(--color-ink-3)]">{name} is already at this table — </span>
            <span style={{ color: "var(--color-gold)" }}>{suggest}?</span>
          </span>
        </button>
      )}
      {err && <p className="field-error not-italic">{err}</p>}
      <button className="btn btn-gold btn-lg btn-block" disabled={!ready || busy} onClick={() => join(name)}>
        {busy ? "Taking your seat…" : "Take my seat"}
      </button>
    </main>
  );
}
export default function JoinPage() { return <Suspense><JoinForm /></Suspense>; }
