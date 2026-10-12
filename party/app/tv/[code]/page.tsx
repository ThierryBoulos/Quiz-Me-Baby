"use client";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Lineup } from "@/components/Lineup";
import { TvStage } from "@/components/TvStage";
import { ensureSession, sb } from "@/lib/supabase";
import { readyToStart, starter, useRoom, type Member, type Room } from "@/lib/room";

const CLASSIC = "https://thierryboulos.github.io/Quiz-Me-Baby/";

/* THE TV. No buttons: it shows the room and runs the night. Phones send it
   actions (a team name, "start", later buzzes and answers); the TV checks the
   sender is allowed to and writes the result back for every phone to see. */
export default function TvRoom() {
  const { code } = useParams<{ code: string }>();
  const { room, members } = useRoom(code);
  const [me, setMe] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => { void ensureSession().then(setMe); setOrigin(window.location.origin); }, []);
  const isTv = !!room && room.tv_id === me;

  useActions(code, isTv, room, members);

  const joinUrl = origin + "/join?code=" + code;
  const host = members.find((m) => m.role === "host");
  const who = starter(members);

  if (!room) return <TvStage><div className="m-auto eyebrow text-[20px]">Opening the room…</div></TvStage>;

  return (
    <TvStage>
      {room.status === "lobby" ? (
        <>
          <div className="flex items-start justify-between gap-10">
            <div>
              <div className="eyebrow text-[16px]">Join on your phone · scan or type</div>
              <div className="display mt-2" style={{ fontSize: 150, color: "var(--color-gold)", textShadow: "6px 6px 0 rgba(49,201,247,.55)", letterSpacing: "0.08em" }}>{code}</div>
              <div className="text-[22px] text-[var(--color-ink-2)] mt-1">{origin.replace(/^https?:\/\//, "")}/join</div>
            </div>
            <div className="rounded-[22px] p-4 bg-[#f4f6ff] shrink-0">
              <QRCodeSVG value={joinUrl} size={200} bgColor="#f4f6ff" fgColor="#04050e" />
            </div>
          </div>
          <div className="mt-8"><Lineup room={room} members={members} big /></div>
          <div className="mt-auto flex items-end justify-between text-[20px] text-[var(--color-ink-2)]">
            <div>
              {host ? <>Hosted by <b style={{ color: "var(--color-gold)" }}>{host.name}</b></> : "No host yet — the app will check answers."}
              <br />
              {readyToStart(members) ? <>Ready. <b>{who?.name}</b> starts the game.</> : "Each team needs a captain."}
            </div>
            {members.length === 0 && <a href={CLASSIC} className="btn btn-sm">Just play on this screen</a>}
          </div>
        </>
      ) : (
        <div className="m-auto text-center enter">
          <div className="eyebrow text-[18px]">{room.mode === "host" ? "Hosted by " + (host?.name || "the host") : "No host tonight — the app is checking answers"}</div>
          <div className="display mt-4" style={{ fontSize: 120, color: "var(--color-gold)" }}>Let&rsquo;s play</div>
          <p className="text-[22px] text-[var(--color-ink-2)] mt-4">The game itself arrives in the next build.</p>
        </div>
      )}
    </TvStage>
  );
}

type Action = { id: number; room: string; user_id: string; kind: string; payload: Record<string, unknown>; at: string };

/* The TV's inbox. Every action is handled once (the last one seen is kept on
   this device), whether it arrives live or is picked up after a refresh. */
function useActions(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const ctx = useRef({ room, members });
  ctx.current = { room, members };
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = Number(localStorage.getItem(key) || 0);
    let busy = false;
    const handle = async (a: Action) => {
      const { room, members } = ctx.current;
      if (!room) return;
      const from = members.find((m) => m.user_id === a.user_id);
      if (a.kind === "team_name" && from?.role === "captain" && from.team === a.payload.team) {
        const names = [...(room.state.teamNames || ["Team A", "Team B"])] as [string, string];
        names[from.team as 0 | 1] = String(a.payload.name || "").slice(0, 18) || names[from.team as 0 | 1];
        await sb().from("rooms").update({ state: { ...room.state, teamNames: names } }).eq("code", code);
      }
      if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && readyToStart(members)) {
        await sb().from("rooms").update({ status: "playing", mode: members.some((m) => m.role === "host") ? "host" : "nohost" }).eq("code", code);
      }
    };
    const drain = async () => {
      if (busy) return; busy = true;
      try {
        const { data } = await sb().from("actions").select("*").eq("room", code).gt("id", last).order("id");
        for (const a of (data || []) as Action[]) { await handle(a); last = a.id; localStorage.setItem(key, String(last)); }
      } finally { busy = false; }
    };
    void drain();
    const ch = sb().channel("actions:" + code)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code }, () => void drain())
      .subscribe();
    const poll = setInterval(() => void drain(), 2000);
    return () => { clearInterval(poll); void sb().removeChannel(ch); };
  }, [code, isTv]);
}
