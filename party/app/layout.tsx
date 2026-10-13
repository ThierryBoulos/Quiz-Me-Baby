import type { Metadata, Viewport } from "next";
import { Anton, Sora } from "next/font/google";
import "./globals.css";
import { NoZoom } from "@/components/NoZoom";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "Quiz Me Baby — Party",
  description: "The quiz night where the TV is the show and your phone is the buzzer.",
};
/* locked like an app: no zooming (see NoZoom for iOS); viewport-fit lets the safe-area padding in .screen work */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: "#04050e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${sora.variable}`}>
      <body><NoZoom />{children}</body>
    </html>
  );
}
