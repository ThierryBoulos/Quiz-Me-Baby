"use client";
/* MANY TEAMS: the phones. The host runs it (Start, Reveal, Next, flip a flag's call, Play again, Exit);
   each captain answers for their team; in Majority Rules everyone answers on their own phone. */
import { useEffect, useMemo, useState } from "react";
import { Clock } from "../Clock";
import { FlagImg, PinPhoto } from "../GameParts";
import { PinMap } from "../PinMap";
import { sendAction, sb } from "@/lib/supabase";
import { showNum, type LatLon } from "@/lib/game";
import type { Member } from "@/lib/room";
import { LETTERS, MANY_TITLES } from "@/lib/many/logic";
import type { PubMany, SecretMany } from "@/lib/many/view";

/* the host's answer card: read straight from the secrets row (only the TV and the host can) */
function useSecretMany(code: string, on: boolean, step: number) {
  const [s, setS] = useState<SecretMany>({});
  useEffect(() => {
    if (!on) return;
    let live = true;
    const pull = () => void sb().from("secrets").select("data").eq("room", code).maybeSingle().then(({ data }) => { if (live && data) setS((data.data || {}) as SecretMany); });
    pull(); const t = setTimeout(pull, 900);
    return () => { live = false; clearTimeout(t); };
  }, [code, on, step]);
  return s;
}
/* each phone its own order of the four (seeded by the player's name: a neighbour's screen tells you nothing) */
function order<T>(xs: T[], seed: string) {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function PhoneMany({ pub, me, code }: { pub: PubMany; me: Member; code: string }) {
  const host = me.role === "host", cap = me.role === "captain", mine = me.team as number | null;
  const g = pub.game, R = pub.reveal, T = pub.teams;
  const secret = useSecretMany(code, host, pub.step);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(""), [pin, setPin] = useState<LatLon | null>(null);
  useEffect(() => { setText(""); setPin(null); setErr(null); }, [pub.qid]);
  const send = async (kind: string, payload: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { await sendAction(code, kind, { ...payload, step: pub.step }); } catch { setErr("That didn't reach the TV. Try again."); }
    setBusy(false);
  };
  const move = (type: string, extra: Record<string, unknown> = {}) => void send("judge", { move: { type, ...extra } });
  const opts = useMemo(() => order(pub.options || [], me.name + (pub.qid || "")), [pub.options, me.name, pub.qid]);
  const sentMine = mine != null && pub.sent[mine];
  const voted = !!pub.voted?.includes(me.name), onList = !!pub.roster?.includes(me.name);
  const Big = ({ label, on }: { label: string; on: () => void }) => <button className="btn btn-gold btn-lg btn-block mt-auto" disabled={busy} onClick={on}>{label}</button>;

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* the scores, small */}
      <div className="grid grid-cols-4 gap-1.5">{T.map((t, i) => (
        <div key={i} className="rounded-[10px] px-2 py-1 text-center" style={{ background: "var(--glass)", border: `1px solid ${i === mine ? t.color : "var(--line)"}` }}>
          <div className="text-11 font-bold truncate" style={{ color: t.color }}>{LETTERS[i]} · {t.name}</div><div className="display text-22 leading-none">{t.score}</div></div>))}</div>
      {g && pub.screen !== "final" && <div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>{MANY_TITLES[g.key]} · {pub.screen === "intro" ? "next up" : pub.screen === "summary" ? "result" : `${g.leg} of ${g.of}`}</div>}

      {/* the question, on every phone */}
      {pub.screen === "q" && g && (<>
        {g.key === "flag" && <div className="flex justify-center"><FlagImg name={pub.flag} h={140} /></div>}
        {g.key === "pin" && <PinPhoto pin={pub.pin} h={180} small zoom />}
        {pub.question && <p className="font-bold text-18 text-center leading-snug">{pub.question}</p>}
        <div className="flex justify-center"><Clock deadline={pub.deadline} left={pub.left} size={70} /></div>
      </>)}

      {/* HOST */}
      {host && (<>
        {pub.screen === "intro" && g && <><p className="text-center text-15 text-[var(--color-ink-2)]">{MANY_TITLES[g.key]} is next. When everyone&rsquo;s ready:</p><Big label="Start" on={() => move("m/start")} /></>}
        {pub.screen === "q" && (<>
          {secret.answer && <div className="card" style={{ borderColor: "rgba(245,197,24,.5)" }}><div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer. Only you see this</div><div className="display text-28 mt-1" style={{ color: "var(--color-gold)" }}>{g?.key === "closest" ? showNum(Number(secret.answer)) : secret.answer}</div></div>}
          <p className="text-center text-14">{g?.key === "majority" ? `${pub.voted?.length ?? 0} of ${pub.roster?.length ?? 0} answered` : `${pub.sent.filter(Boolean).length} of ${T.length} teams in`}</p>
          <button className="btn btn-block mt-auto" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button>
        </>)}
        {pub.screen === "reveal" && g?.key === "flag" && R && (
          <div className="card flex flex-col gap-1.5"><div className="eyebrow">The app&rsquo;s calls · tap to change one</div>
            {T.map((t, i) => (
              <button key={i} className="flex items-center justify-between gap-2 min-h-[40px] text-left" disabled={busy} onClick={() => move("m/flip", { t: i })}>
                <span className="truncate"><b style={{ color: t.color }}>{t.name}</b> · {R.typed?.[i] ?? "No answer"}</span>
                <b style={{ color: R.ok?.[i] ? "var(--color-ok)" : "var(--color-no)" }}>{R.ok?.[i] ? "RIGHT" : "WRONG"}</b></button>))}
          </div>)}
        {(pub.screen === "reveal" || pub.screen === "summary") && <Big label="Next" on={() => move("m/next")} />}
        {pub.screen === "final" && (<div className="flex flex-col gap-2 mt-auto">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => move("m/again")}>Play again: same teams</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => move("m/exit")}>Exit: everyone back to the home screen</button></div>)}
      </>)}

      {/* MAJORITY RULES: everyone on the list answers */}
      {!host && pub.screen === "q" && g?.key === "majority" && (
        !onList ? <p className="text-center text-15 text-[var(--color-ink-2)]">You joined after this game started: watch this one.</p>
          : voted ? <p className="text-center display text-32" style={{ color: "var(--color-gold)" }}>Locked in</p>
          : <div className="grid gap-2">{opts.map((o) => <button key={o} className="btn btn-lg btn-block" disabled={busy} onClick={() => void send("answer", { pick: o, k: `${pub.qid}|q` })}><bdi>{o}</bdi></button>)}</div>)}

      {/* THE CAPTAIN answers the other three */}
      {cap && pub.screen === "q" && g && g.key !== "majority" && (
        sentMine ? <p className="text-center display text-32" style={{ color: "var(--color-gold)" }}>Sent. Eyes on the TV</p> : (
          <div className="card flex flex-col gap-2">
            {g.key === "pin" ? (<>
              <PinMap value={pin} onChange={setPin} color={mine != null ? T[mine].color : undefined} height={300} label="Drop your pin" />
              <button className="btn btn-gold btn-lg" disabled={busy || !pin} onClick={() => void send("answer", { pin, k: `${pub.qid}|q` })}>Lock in</button>
            </>) : (<>
              <label className="field-label !mb-0" htmlFor="mans">{g.key === "closest" ? "Your number" : "Your answer"}</label>
              <input id="mans" className="input" autoComplete="off" inputMode={g.key === "closest" ? "decimal" : "text"} value={text} onChange={(e) => setText(e.target.value)} placeholder={g.key === "closest" ? "A number" : "Type it"} />
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim()} onClick={() => void send("answer", g.key === "closest" ? { n: text, k: `${pub.qid}|q` } : { text, k: `${pub.qid}|q` })}>Send</button>
              <p className="text-12 text-[var(--color-ink-3)]">One go: once it&rsquo;s sent, it&rsquo;s locked.</p>
            </>)}
          </div>))}
      {!host && !cap && pub.screen === "q" && g && g.key !== "majority" && <p className="text-center text-15 text-[var(--color-ink-2)]">Your captain answers this one. Shout your idea.</p>}

      {/* the result, on every phone that isn't the host's */}
      {!host && pub.screen === "reveal" && R && <div className="text-center"><div className="eyebrow">The answer</div><div className="display text-36" style={{ color: "var(--color-gold)" }}>{g?.key === "closest" ? showNum(Number(R.answer)) : R.answer}</div>
        {mine != null && g?.key !== "majority" && <p className="text-15 font-bold mt-1" style={{ color: R.winners.includes(mine) ? "var(--color-ok)" : "var(--color-ink-3)" }}>{R.winners.includes(mine) ? "Your team takes this one!" : "Not this time."}</p>}</div>}
      {!host && pub.screen === "summary" && pub.summary && mine != null && <p className="text-center text-18 font-bold">{pub.summary.award[mine] > 0 ? `Your team: +${pub.summary.award[mine]}` : "No points for your team this time."}</p>}
      {!host && pub.screen === "final" && pub.final && mine != null && <div className="text-center"><div className="eyebrow">Your team finished</div><div className="display text-52" style={{ color: "var(--color-gold)" }}>{["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][pub.final.order.find((x) => x.team === mine)?.place ?? 0]}</div></div>}
      {!host && (pub.screen === "intro") && <p className="text-center text-15 text-[var(--color-ink-2)]">Eyes on the TV. The host starts it.</p>}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
    </div>);
}
