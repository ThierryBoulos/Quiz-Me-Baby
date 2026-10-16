import { ImageResponse } from "next/og";

/* The picture WhatsApp (and others) show under a shared link */
export const alt = "Quiz Me Baby: the party quiz. Tap to join.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at 50% 30%, #1b1640 0%, #04050e 70%)", color: "#f4f6ff", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 150, fontWeight: 900, color: "#F5C518", letterSpacing: 4, textShadow: "8px 8px 0 rgba(49,201,247,.55)" }}>QUIZ ME BABY</div>
        <div style={{ fontSize: 48, marginTop: 24, color: "#c8cbe8" }}>The TV is the show. Your phone is the buzzer.</div>
        <div style={{ fontSize: 40, marginTop: 40, padding: "14px 36px", borderRadius: 999, background: "#F5C518", color: "#04050e", fontWeight: 800 }}>Tap to join the game</div>
      </div>
    ),
    size,
  );
}
