import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NOTE: We do NOT use `output: "export"` because the dynamic /instance/[id]
  // route is fully client-rendered (the available node IDs come from a live
  // API). If you want a static export for distribution as a Komari theme,
  // pre-render a known set of node UUIDs by adding generateStaticParams() in
  // a non-"use client" wrapper file and set `dynamicParams = false`.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;