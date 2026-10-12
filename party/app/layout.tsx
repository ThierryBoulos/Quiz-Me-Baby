import type { Metadata, Viewport } from "next";
import { Anton, Sora } from "next/font/google";
import "./globals.css";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "Quiz Me Baby — Party",
  description: "The quiz night where the TV is the show and your phone is the buzzer.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#04050e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
