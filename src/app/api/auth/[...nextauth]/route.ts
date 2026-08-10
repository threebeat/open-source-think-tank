import type { NextRequest } from "next/server";

import { resolveAppMode } from "@/lib/env/app-mode";

async function gatedHandlers() {
  const { handlers } = await import("@/lib/auth/next-auth");
  return handlers;
}

export async function GET(request: NextRequest) {
  if (resolveAppMode() !== "gated") {
    return new Response("Not Found", { status: 404 });
  }
  const handlers = await gatedHandlers();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (resolveAppMode() !== "gated") {
    return new Response("Not Found", { status: 404 });
  }
  const handlers = await gatedHandlers();
  return handlers.POST(request);
}
