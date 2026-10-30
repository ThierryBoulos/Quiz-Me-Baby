"use client";
/* MANY TEAMS: the phones, laid out as the two-team phones are (components/PhoneGame.tsx): the host's answer
   card on top and one main button docked at the bottom; a captain's answer box, the pin map, the four answers
   of Majority Rules; a result as a headline, then the rows. No score strip: the scores sit behind the Scores
   button in the header, and the tracker says whose side you're on. */
import { useEffect, useMemo, useState } from "react";
import { Clock } from "../Clock";
import { Board, FlagImg, PinPhoto, RulingPicker } from "../GameParts";
import { MapView } from "../MapView";
import { PinMap } from "../PinMap";
import { sendAction, sb } from "@/lib/supabase";
import { showKm, showNum, type LatLon } from "@/lib/game";
import type { Member } from "@/lib/room";
import type { PubMany, SecretMany } from "@/lib/many/view";
import { typedKey } from "@/lib/many/logic";
import { BoardMany, byDistance, closestCols, Dot, finalCols, FlagRowsMany, HudMany, IntroMany, kmOf, paid, place, RowsMany, splitIng, summaryCols, takes } from "./PartsMany";

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
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
const Line = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <p className={"text-center text-15 text-[var(--color-ink-2)] " + className} role="status">{children}</p>;

export function PhoneMany({ pub, me, code }: { pub: PubMany; me: Member; code: string }) {
  const host = me.role === "host", cap = me.role === "captain", mine = me.team as number | null;
  const g = pub.game, R = pub.reveal, T = pub.teams, sc = pub.screen;
  const secret = useSecretMany(code, host, pub.step);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(""), [pin, setPin] = useState<LatLon | null>(null), [sentTxt, setSentTxt] = useState<string | null>(null);
  useEffect(() => { setText(""); setPin(null); setErr(null); setSentTxt(null); }, [pub.qid]);
  const send = async (kind: string, payload: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { await sendAction(code, kind, { ...payload, step: pub.step }); return true; } catch { setErr("That didn't reach the TV. Try again."); return false; } finally { setBusy(false); }
  };
  const move = (type: string, extra: Record<string, unknown> = {}) => void send("judge", { move: { type, ...extra } });
  const opts = useMemo(() => order(pub.options || [], me.name + (pub.qid || "")), [pub.options, me.name, pub.qid]);
  const sentMine = mine != null && pub.sent[mine];
  const voted = !!pub.voted?.includes(me.name), onList = !!pub.roster?.includes(me.name);
  /* the host's one main button, docked in thumb reach */
  const Main = ({ label, on }: { label: string; on: () => void }) => <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={on}>{label}</button>;
  /* a big outcome headline, no box (boxes are for things you can tap) */
  const Big = ({ eyebrow, text, color, size = 32, sub }: { eyebrow?: string; text: React.ReactNode; color?: string; size?: number; sub?: React.ReactNode }) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="display leading-tight" style={{ fontSize: typeof text === "string" && text.length > 18 ? 28 : size, color: color ?? "var(--color-gold)" }}>{text}</div>
      {sub && <div className="text-13 font-bold">{sub}</div>}
    </div>);
  /* "That's your team!", under who takes it */
  const W = takes(pub);
  /* your team's place on this leg, or in this game, and what it scores: "2nd, +7", "No points this time" */
  const mineLeg = () => { if (mine == null || !R?.places) return undefined; const p = R.places[mine], v = R.pts?.[mine] ?? 0;
    return <span style={{ color: v ? "var(--color-ok)" : "var(--color-ink-3)" }}>{p == null || !v ? "No points this time." : `Your team: ${place(p)}, +${v}`}</span>; };
  const mineGame = () => { if (mine == null || !pub.summary) return undefined; const S = pub.summary, v = S.award[mine];
    return <span style={{ color: v ? "var(--color-ok)" : "var(--color-ink-3)" }}>{v ? `Your team: ${place(S.places[mine])}, +${v} to the night` : "No points for your team this game."}</span>; };

  /* what's on screen, close up: the flag, the photo, the question, and the clock. It can't be selected or copied */
  const OnScreen = ({ small }: { small?: boolean }) => sc !== "q" || !g ? null : (
    <div className="noselect contents" {...noCopy}>
      {g.key === "flag" && <FlagImg name={pub.flag} h={small ? 110 : 150} />}
      {g.key === "airport" && <Board air={pub.airport} size="phone" flip />}
      {g.key === "map" && pub.map && <MapView id={pub.map.id} reveal={false} maxH={small ? 180 : 240} legend={false} />}
      {g.key === "dish" && pub.dish && (
        <div className="card !py-2">
          <div className="eyebrow mb-1" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div>
          <ol className="flex flex-col gap-0.5 text-15">{pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{name}</b>{qty && <span className="text-13 text-[var(--color-ink-2)]">{qty}</span>}</li>; })}</ol>
        </div>)}
      {g.key === "quiz" && pub.theme && <div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>{pub.theme}</div>}
      {g.key === "pin" && (small
        ? <div className="flex items-center justify-center gap-4"><PinPhoto pin={pub.pin} h={112} small zoom /><Clock deadline={pub.deadline} left={pub.left} size={64} /></div>
        : <PinPhoto pin={pub.pin} h={230} small zoom />)}
      {pub.question && <p className={"font-bold leading-snug text-center " + (pub.question.length > 120 ? "text-16" : "text-20")}>{pub.question}</p>}
      {!(small && g.key === "pin") && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} size={small ? 70 : 90} /></div>}
    </div>);
  /* the answer, on a reveal: big, in gold, with the fact behind it */
  const Answer = () => !R || !g ? null : (
    <div className="noselect text-center" {...noCopy}>
      {g.key === "flag" && <div className="mb-2"><FlagImg name={pub.flag} h={96} /></div>}
      {g.key === "map" && pub.map && <div className="mb-2"><MapView id={pub.map.id} reveal maxH={180} legend={false} /></div>}
      {(g.key === "quiz" || g.key === "say") && pub.question && <p className="font-bold text-16 leading-snug mb-1">{pub.question}</p>}
      {g.key === "pin" && R.at && <div className="mb-3"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
        ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
        fly height={240} label={`Where it is: ${R.place}`} /></div>}
      {g.key === "majority" && pub.question && <p className="font-bold text-18 leading-snug mb-1">{pub.question}</p>}
      {g.key !== "pin" && <div className="eyebrow">{g.key === "say" ? "The app's secret answer" : "The answer"}</div>}
      <div className="display text-30" style={{ color: "var(--color-gold)" }}>{g.key === "closest" ? showNum(Number(R.answer)) : R.answer}</div>
      {(R.notes || R.place) && <p className="text-14 text-[var(--color-ink-2)] leading-snug mt-1">{R.place || R.notes}</p>}
    </div>);
  /* a reveal's rows: each team's line (Majority Rules: right out of how many; the rest: how near) */
  const Rows = () => !R || !g ? null : typedKey(g.key) ? <FlagRowsMany pub={pub} size="phone" />
    : g.key === "closest" ? <BoardMany pub={pub} cols={closestCols(pub)} size="phone" label="Nearest first" />
    : g.key === "pin" ? <RowsMany pub={pub} order={byDistance(pub)} right={(t) => kmOf(pub, t)} size="phone" pts={R.pts} />
    : <RowsMany pub={pub} order={T.map((_, i) => i)} right={(t) => <span className="text-16 font-bold" style={{ fontFamily: "var(--font-body)", textTransform: "none" }}>{R.right?.[t] ?? 0} of {R.of?.[t] ?? 0}</span>} size="phone" />;
  /* a game's result and the night's end, the same on every phone */
  const Summary = () => !g || !pub.summary ? null : (<>
    <Big text={paid(pub).text} color={paid(pub).color} eyebrow={g.title} sub={mineGame()} />
    <BoardMany pub={pub} cols={summaryCols(pub)} size="phone" label={pub.summary.shares ? "Share right" : "Points this game"} />
    {pub.summary.line && <p className="text-13 text-center" style={{ color: "var(--color-gold)" }}>{pub.summary.line}</p>}
  </>);
  const Final = () => { if (!pub.final) return null; const tops = pub.final.order.filter((x) => x.place === 1).map((x) => x.team), c = tops.length === 1 ? T[tops[0]].color : "var(--color-gold)";
    const my = mine != null ? pub.final.order.find((x) => x.team === mine)?.place : undefined;
    return (
      <div className="text-center flex flex-col gap-2 py-2" role="status" aria-live="polite">
        <div className="eyebrow">{tops.length > 1 ? "A shared win" : "The winner"}</div>
        <div className="display text-52 leading-none" style={{ color: c }}><bdi>{tops.map((t) => T[t].name).join(" & ")}</bdi></div>
        {my != null && <div className="text-15 font-bold" style={{ color: my === 1 ? "var(--color-ok)" : "var(--color-ink-3)" }}>{my === 1 ? "You won the night!" : `Your team finished ${place(my)}.`}</div>}
        <div className="mt-2"><BoardMany pub={pub} cols={finalCols(pub)} size="phone" label="Final standings" /></div>
      </div>); };

  return (
    <div className="flex flex-col gap-4 flex-1">
      <HudMany pub={pub} size="phone" me={mine} host={host} />

      {/* THE HOST: the answer on top, one main button */}
      {host && sc === "intro" && g && (<>
        <IntroMany pub={pub} size="phone" />
        <Main label={g.key === "majority" ? "Start: everyone's in" : "Start"} on={() => move("m/start")} />
      </>)}
      {host && sc === "q" && g && (<>
        <OnScreen />
        {secret.answer && (
          <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer. Only you see this</div>
            <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{g.key === "closest" ? showNum(Number(secret.answer)) : secret.answer}</div>
            {secret.notes && <div className="text-13 text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
          </div>)}
        {/* who's in: every team, as the TV shows them */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1" role="status" aria-label="Who has answered">
          {g.key === "majority" && <p className="col-span-2 text-center text-14 font-bold mb-1">{pub.voted?.length ?? 0} of {pub.roster?.length ?? 0} answered</p>}
          {T.map((t, i) => <span key={i} className="flex items-center gap-2 min-w-0 text-14 font-bold" style={{ color: pub.sent[i] ? t.color : "var(--color-ink-3)" }}><Dot t={i} color={t.color} size={14} /><span className="truncate"><bdi>{t.name}</bdi></span><span className="shrink-0 font-semibold">{pub.sent[i] ? (g.key === "pin" ? "· pin in" : g.key === "majority" ? "· all in" : "· in") : "…"}</span></span>)}
        </div>
        <div className="flex justify-center mt-auto"><button className="btn btn-sm" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button></div>
      </>)}
      {host && sc === "reveal" && g && R && (<>
        <Answer />
        {typedKey(g.key) ? (
          /* each team's answer, and its ruling beside it, which the host can always flip (the TV confirms it a beat later) */
          <div className="flex flex-col gap-3">{T.map((t, i) => { const x = R.typed?.[i], v = R.ok?.[i]; return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="eyebrow flex items-center gap-2" style={{ color: t.color }}><Dot t={i} color={t.color} size={14} /><span className="truncate"><bdi>{t.name}</bdi></span></div>
                {x ? <div className="font-bold text-18 leading-snug break-words"><bdi>{x}</bdi></div> : <div className="text-14 text-[var(--color-ink-3)]">No answer</div>}
              </div>
              {x && <div className="w-[172px] shrink-0"><RulingPicker compact sticky value={v} say={g.key === "say"} label={`Rule on ${t.name}’s answer`} busy={busy} onPick={() => move("m/flip", { t: i })} /></div>}
            </div>); })}</div>
        ) : <Rows />}
        {g.key !== "majority" && <Big text={W.text} color={W.color} />}
        <Main label="Next" on={() => move("m/next")} />
      </>)}
      {host && sc === "summary" && (<><Summary /><Main label="Next" on={() => move("m/next")} /></>)}
      {host && sc === "final" && (<>
        <Final />
        <div className="mt-auto flex flex-col gap-2">
          <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => move("m/again")}>Play again: same teams</button>
          <p className="text-center text-13 text-[var(--color-ink-3)]">Exit takes every phone and the TV back to the home screen.</p>
          <button className="btn btn-lg btn-block" disabled={busy} onClick={() => { move("m/exit"); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
        </div>
      </>)}

      {/* EVERYONE ELSE */}
      {!host && sc === "intro" && g && (<>
        <IntroMany pub={pub} size="phone" />
        <Line className="mt-auto">Eyes on the TV. The host starts it.</Line>
      </>)}

      {/* MAJORITY RULES: everyone on the list answers, on their own phone */}
      {!host && sc === "q" && g?.key === "majority" && (<>
        <p className="text-center text-14 font-bold text-[var(--color-ink-2)]">Your own answer: eyes on your phone, no talking</p>
        <OnScreen />
        {!onList ? <Line>You joined after it started, so you&rsquo;re watching this one. You&rsquo;ll play the next Majority Rules.</Line>
          : voted ? <p className="text-center font-bold text-16" role="status">Locked in. The answer comes up when the time&rsquo;s up.</p>
          : <div className="flex flex-col gap-2">
            <div className="grid gap-2.5" role="group" aria-label="The four answers">
              {opts.map((o) => <button key={o} type="button" className="btn btn-lg btn-block mr-opt" disabled={busy} onClick={() => void send("answer", { pick: o, k: `${pub.qid}|q` })}><bdi>{o}</bdi></button>)}
            </div>
            <p className="text-center text-12 text-[var(--color-ink-3)]">One tap, and it&rsquo;s locked.</p>
          </div>}
      </>)}

      {/* sudden death: a captain whose team isn't level at the top watches */}
      {cap && sc === "q" && g?.only && mine != null && !g.only.includes(mine) && (<><OnScreen /><Line>Sudden death: only the teams level at the top answer this one.</Line></>)}
      {/* THE CAPTAIN answers the rest */}
      {cap && sc === "q" && g && g.key !== "majority" && !(g.only && mine != null && !g.only.includes(mine)) && (<>
        <OnScreen small={g.key === "pin" && !sentMine} />
        {sentMine ? <p className="text-center font-bold text-16" role="status" style={pub.out?.[mine!] ? { color: "var(--color-no)" } : undefined}>
            {pub.out?.[mine!] ? `Wrong${sentTxt ? `: ${sentTxt}` : ""}. Your team is out of this one.` : `Locked in${sentTxt && g.key !== "pin" ? `: ${sentTxt}` : ""}.`}</p>
          : g.key === "pin" ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-13 text-[var(--color-ink-3)]">{pin ? "Drag your pin to move it. Zoom in (pinch, or +) to place it exactly." : "Tap the map to drop your pin."}</p>
              <PinMap value={pin} onChange={setPin} color={mine != null ? T[mine].color : undefined} height="min(520px, max(300px, calc(100dvh - 460px)))" />
              <button className="btn btn-gold btn-lg btn-block dock" disabled={busy || !pin} onClick={() => void send("answer", { pin, k: `${pub.qid}|q` })}>Lock in</button>
            </div>
          ) : (
            <div className="card flex flex-col gap-2">
              <label className="field-label !mb-0" htmlFor="mans">{g.key === "closest" ? "Your number" : "Your answer"}</label>
              <input id="mans" className="input" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={80} inputMode={g.key === "closest" ? "decimal" : "text"} value={text} onChange={(e) => setText(e.target.value)} placeholder={g.key === "closest" ? "e.g. 236" : "Type it"} />
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim()} onClick={() => { const t = text.trim(); void send("answer", g.key === "closest" ? { n: t, k: `${pub.qid}|q` } : { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) setSentTxt(t); }); }}>{g.key === "closest" ? "Lock in" : "Send"}</button>
              <div className="text-13 text-[var(--color-ink-3)]">{g.key === "dish" ? "One guess for your team: a wrong one puts you out of this recipe. The first right answer wins it." : g.key === "say" ? "One answer on the list: not the app's secret one, and not the same as another team's." : `One go: once you send it, it’s locked${typedKey(g.key) ? " and the app checks it" : ""}.`}</div>
            </div>)}
        {sentMine && g.key === "pin" && pin && <PinMap value={pin} color={mine != null ? T[mine].color : undefined} height="min(40vh, 340px)" label="Your pin" />}
      </>)}
      {!host && !cap && sc === "q" && g && g.key !== "majority" && (<>
        <OnScreen />
        <Line>Your captain answers this one. Shout your idea.</Line>
      </>)}

      {/* the result, on every phone that isn't the host's: who takes it, the answer, then the rows */}
      {!host && sc === "reveal" && g && R && (<>
        {g.key !== "majority" && <Big text={W.text} color={W.color} sub={mineLeg()} />}
        <Answer />
        {g.key === "majority" && mine != null && <p className="text-center font-bold text-15" style={{ color: (R.right?.[mine] ?? 0) > 0 ? "var(--color-ok)" : "var(--color-ink-3)" }}><bdi>{T[mine].name}</bdi>: {R.right?.[mine] ?? 0} of {R.of?.[mine] ?? 0} right</p>}
        <Rows />
      </>)}
      {!host && sc === "summary" && <Summary />}
      {!host && sc === "final" && <Final />}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
    </div>);
}
