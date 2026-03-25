import { NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/strava";

export async function GET() {
  return NextResponse.redirect(getStravaAuthUrl());
}
