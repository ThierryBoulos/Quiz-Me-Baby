"use client";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Lineup } from "@/components/Lineup";
import { TvGame } from "@/components/TvGame";
import { TvStage } from "@/components/TvStage";
import { useTvGame } from "@/lib/tvGame";
import { ensureSession } from "@/lib/supabase";
import { notReadyWhy, readyToStart, starter, useRoom } from "@/lib/room";
import type { Pub } from "@/lib/game";

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

  const { pub: own } = useTvGame(code, isTv, room, members);
  const pub = own || ((room?.state?.pub || null) as Pub | null);
  /* for the end-to-end tests: what the TV is showing */
  useEffect(() => { (window as unknown as { __qmb?: Pub | null }).__qmb = pub; }, [pub]);

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
              {readyToStart(members) ? <>Ready. <b>{who?.name}</b> starts the game.</> : notReadyWhy(members)}
            </div>
            {members.length === 0 && <a href={CLASSIC} className="btn btn-sm">Just play on this screen</a>}
          </div>
        </>
      ) : pub ? <TvGame pub={pub} /> : (
        <div className="m-auto text-center enter">
          <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>Let&rsquo;s play</div>
        </div>
      )}
    </TvStage>
  );
}
