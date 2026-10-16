import type { MetadataRoute } from "next";

/* "Add to Home Screen": an icon, the app's name, full screen, no browser bars */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quiz Me Baby", short_name: "Quiz Me Baby",
    description: "The quiz night where the TV is the show and your phone is the buzzer.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#04050e", theme_color: "#04050e",
    icons: [
      { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
