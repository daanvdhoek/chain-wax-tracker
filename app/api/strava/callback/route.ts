import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const tokenData = await exchangeCodeForToken(code);

  await prisma.userSettings.upsert({
    where: { id: "singleton" },
    update: {
      stravaAthleteId: String(tokenData.athlete.id),
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiresAt: new Date(tokenData.expires_at * 1000),
    },
    create: {
      id: "singleton",
      stravaAthleteId: String(tokenData.athlete.id),
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiresAt: new Date(tokenData.expires_at * 1000),
      targetKm: Number(process.env.TARGET_KM ?? 270),
    },
  });

  return NextResponse.json({
  ok: true,
  athleteId: String(tokenData.athlete.id),
});
}