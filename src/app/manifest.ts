import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Open-Source Think Tank Demonstration",
    short_name: "OSTT Demo",
    description:
      "Phase 1 browser demonstration of a proposed open-source think tank using synthetic data only.",
    start_url: "/",
    display: "browser",
    background_color: "#f3f4f0",
    theme_color: "#2f6f73",
    lang: "en",
  };
}
