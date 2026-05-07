import type { NextConfig } from "next";

// On Vercel (VERCEL=1), build as static export — no server, no API routes.
// Locally, API routes are available for auto-reading ~/.claude/projects.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? "export" : undefined,
};

export default nextConfig;
