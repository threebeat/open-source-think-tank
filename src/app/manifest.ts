import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commonhall (pre-alpha)",
    short_name: "Commonhall",
    description:
      "Proposed computational-democracy digital town hall. This pre-alpha uses synthetic data only.",
    start_url: "/",
    display: "browser",
    background_color: "#f4f6fb",
    theme_color: "#2c4a8c",
    lang: "en",
  };
}
