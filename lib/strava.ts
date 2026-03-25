import { prisma } from "@/lib/db";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export function getStravaAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });

  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to exchange Strava code: ${res.status}`);
  }

  return res.json();
}

export async function getValidStravaAccessToken() {
  const settings = await prisma.userSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings?.stravaRefreshToken) {
    throw new Error("Strava not connected yet.");
  }

  const now = Date.now();
  const expiresAt = settings.stravaTokenExpiresAt?.getTime() ?? 0;

  if (settings.stravaAccessToken && expiresAt - now > 60_000) {
    return settings.stravaAccessToken;
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: settings.stravaRefreshToken,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Strava token: ${res.status}`);
  }

  const tokenData = await res.json();

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

  return tokenData.access_token as string;
}

export async function getStravaActivity(activityId: string | number) {
  const accessToken = await getValidStravaAccessToken();

  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch activity ${activityId}: ${res.status}`);
  }

  return res.json();
}