import type { Metadata, Viewport } from "next";
import { Anton, Sora } from "next/font/google";
import "./globals.css";
import { NoZoom } from "@/components/NoZoom";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-sora" });

export const metadata: Metadata = {
  /* absolute links for the share preview (WhatsApp needs a full URL for the picture) */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://quiz-me-baby-eta.vercel.app"),
  title: "Quiz Me Baby — Party",
  description: "The quiz night where the TV is the show and your phone is the buzzer.",
  applicationName: "Quiz Me Baby",
  /* added to an iPhone's home screen: its own icon, full screen */
  appleWebApp: { capable: true, title: "Quiz Me Baby", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-180.png", apple: "/icons/icon-180.png" },
  openGraph: { title: "Quiz Me Baby", description: "Tap to join the quiz. The TV is the show, your phone is the buzzer.", type: "website", siteName: "Quiz Me Baby" },
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
