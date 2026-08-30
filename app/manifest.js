export default function manifest() {
  return {
    name: "Spotnera",
    short_name: "Spotnera",
    description: "Discover nearby businesses, live deals and local activity.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#101217",
    theme_color: "#101217",
    categories: ["shopping", "food", "lifestyle", "travel"],
    icons: [
      {
        src: "/icons/spotnera-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/spotnera-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/spotnera-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/spotnera-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
