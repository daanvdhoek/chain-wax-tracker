import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStravaActivity } from "@/lib/strava";

async function applyRideToInstalledChain(input: {
  stravaActivityId: string;
  distanceKm: number;
  startDate: Date;
}) {
  const existing = await prisma.ride.findUnique({
    where: { stravaActivityId: input.stravaActivityId },
  });

  if (existing) {
    return { status: "duplicate" as const };
  }

  const installed = await prisma.chain.findFirst({
    where: { isInstalled: true },
  });

  if (!installed) {
    throw new Error("No installed chain set.");
  }

  const updatedChain = await prisma.chain.update({
    where: { id: installed.id },
    data: {
      totalKm: { increment: input.distanceKm },
      kmSinceWax: { increment: input.distanceKm },
    },
  });

  await prisma.ride.create({
    data: {
      stravaActivityId: input.stravaActivityId,
      distanceKm: input.distanceKm,
      startDate: input.startDate,
      chainName: installed.name,
    },
  });

  const targetKm =
    (await prisma.userSettings.findUnique({ where: { id: "singleton" } }))?.targetKm ??
    Number(process.env.TARGET_KM ?? 270);

  await prisma.event.create({
    data: {
      type: updatedChain.kmSinceWax >= targetKm ? "alert" : "ride",
      details:
        updatedChain.kmSinceWax >= targetKm
          ? `${updatedChain.name} reached ${updatedChain.kmSinceWax.toFixed(1)} km since wax. Switch chains now.`
          : `Imported ${input.distanceKm.toFixed(1)} km from Strava to ${installed.name}`,
    },
  });

  return { status: "processed" as const };
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const payload = await req.json();

  if (payload.object_type !== "activity" || payload.aspect_type !== "create") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings?.stravaAthleteId) {
      return NextResponse.json({ ok: true, skipped: "no strava user" });
    }

    if (String(payload.owner_id) !== String(settings.stravaAthleteId)) {
      return NextResponse.json({ ok: true, skipped: "different athlete" });
    }

    const activity = await getStravaActivity(payload.object_id);

    if (activity.type !== "Ride" && activity.sport_type !== "Ride") {
      return NextResponse.json({ ok: true, skipped: "not a ride" });
    }

    const distanceKm = Number(activity.distance) / 1000;

    const result = await applyRideToInstalledChain({
      stravaActivityId: String(activity.id),
      distanceKm,
      startDate: new Date(activity.start_date),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}