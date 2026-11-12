"use client";
import { useEffect, useState, type ReactNode } from "react";

/* DATA PRIVACY: an underlined link at the foot of Settings (7 Nov, the owner: out of How to Play), opening a window
   with what the game keeps and the copyright and credits. */
const H = ({ children }: { children: ReactNode }) => <h3 className="eyebrow mt-2" style={{ color: "var(--color-gold)" }}>{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="text-14 leading-relaxed text-[var(--color-ink-2)]">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <strong className="text-[var(--color-ink)]">{children}</strong>;
const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">{children}</a>;

export function DataPrivacy() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (<>
    <button type="button" className="self-center text-14 text-[var(--color-ink-2)] underline underline-offset-4 py-3 px-2" onClick={() => setOpen(true)}>Data privacy</button>
    {open && (
      <div className="fixed inset-0 z-50 grid place-items-center p-4 enter" style={{ background: "rgba(3,4,10,.82)" }} role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={() => setOpen(false)}>
        <div className="card w-full max-w-[520px] max-h-[85vh] overflow-y-auto flex flex-col gap-2" style={{ background: "#10142e" }} onClick={(e) => e.stopPropagation()}>
          <h2 id="privacy-title" tabIndex={-1} autoFocus className="display text-26 outline-none">Data privacy and copyright</h2>

          <H>Your data</H>
          <P><B>No accounts.</B> Each phone gets an anonymous sign-in: no email, no phone number, no password.</P>
          <P><B>What the server keeps.</B> A room&rsquo;s names, teams, answers and scores, for three days; then the room is deleted. A sign-in unused for 7 days is deleted too.</P>
          <P><B>What stays on your device.</B> The TV (or the phone running the game) keeps the game in progress and the questions it has played in its own browser, with your settings and any questions you added. Clearing the browser&rsquo;s data removes them.</P>
          <P><B>Where.</B> The server is Supabase, in the EU (Ireland); the site is hosted by Vercel. No ads, no trackers, nothing sold or shared.</P>

          <H>Copyright</H>
          <P>&copy; 2026 Thierry Boulos. Quiz Me Baby, its design, Imad and its questions. All rights reserved.</P>
          <P><B>Flags</B> from Wikimedia Commons, most in the public domain (<A href="/flags/CREDITS.md">flag credits</A>). <B>Drop the Pin photos</B> from Wikimedia Commons, each under the licence named in the <A href="/pins/CREDITS.md">photo credits</A>. <B>Maps</B> from Natural Earth (public domain). <B>Fonts</B>: Anton and Sora, under the SIL Open Font License.</P>
          <P><B>What Do You See? pictures</B> from Wikimedia Commons, each under the licence named in the <A href="/see/CREDITS.md">picture credits</A>. Quiz Me Baby isn&rsquo;t associated with any brand, celebrity or person shown. To have a picture removed, write to Thierryboulos@hotmail.com.</P>
          <P>Some questions are adapted from Open Trivia DB (opentdb.com).</P>
          <P>The shows, films, games, brands, bands and people named in the questions belong to their owners. They&rsquo;re named for trivia only; Quiz Me Baby isn&rsquo;t linked to or endorsed by any of them.</P>

          <button type="button" className="btn btn-gold btn-block mt-2" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>)}
  </>);
}
