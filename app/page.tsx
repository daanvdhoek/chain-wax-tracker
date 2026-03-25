import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function seedData() {
  "use server";

  const count = await prisma.chain.count();
  if (count > 0) return;

  await prisma.chain.createMany({
    data: [
      {
        name: "Chain A",
        totalKm: 0,
        kmSinceWax: 0,
        isInstalled: true,
        lastWaxedAt: new Date(),
      },
      {
        name: "Chain B",
        totalKm: 0,
        kmSinceWax: 0,
        isInstalled: false,
        lastWaxedAt: new Date(),
      },
    ],
  });

  await prisma.event.create({
    data: {
      type: "seed",
      details: "Created starter chains",
    },
  });

  revalidatePath("/");
}



async function addRide(formData: FormData) {
  "use server";

  const distanceKm = Number(formData.get("distanceKm"));
  if (!distanceKm || distanceKm <= 0) return;

  const installed = await prisma.chain.findFirst({
    where: { isInstalled: true },
  });

  if (!installed) return;

  await prisma.chain.update({
    where: { id: installed.id },
    data: {
      totalKm: { increment: distanceKm },
      kmSinceWax: { increment: distanceKm },
    },
  });

  await prisma.event.create({
    data: {
      type: "ride",
      details: `Added ${distanceKm} km to ${installed.name}`,
    },
  });

  revalidatePath("/");
}

async function switchChain(formData: FormData) {
  "use server";

  const chainId = String(formData.get("chainId"));
  if (!chainId) return;

  const current = await prisma.chain.findFirst({
    where: { isInstalled: true },
  });

  if (current?.id === chainId) return;

  if (current) {
    await prisma.chain.update({
      where: { id: current.id },
      data: { isInstalled: false },
    });
  }

  const next = await prisma.chain.update({
    where: { id: chainId },
    data: { isInstalled: true },
  });

  await prisma.event.create({
    data: {
      type: "switch",
      details: `Switched to ${next.name}`,
    },
  });

  revalidatePath("/");
}

async function rewaxChain(formData: FormData) {
  "use server";

  const chainId = String(formData.get("chainId"));
  if (!chainId) return;

  const chain = await prisma.chain.update({
    where: { id: chainId },
    data: {
      kmSinceWax: 0,
      lastWaxedAt: new Date(),
    },
  });

  await prisma.event.create({
    data: {
      type: "rewax",
      details: `Rewaxed ${chain.name}`,
    },
  });

  revalidatePath("/");
}

async function updateStartingKm(formData: FormData) {
  "use server";

  const chainId = String(formData.get("chainId"));
  const totalKm = Number(formData.get("totalKm"));
  const kmSinceWax = Number(formData.get("kmSinceWax"));

  if (!chainId) return;
  if (Number.isNaN(totalKm) || Number.isNaN(kmSinceWax)) return;

  await prisma.chain.update({
    where: { id: chainId },
    data: {
      totalKm,
      kmSinceWax,
    },
  });

  await prisma.event.create({
    data: {
      type: "edit",
      details: `Updated km for chain ${chainId}`,
    },
  });

  revalidatePath("/");
}

export default async function HomePage() {
  const targetKm = Number(process.env.TARGET_KM ?? 270);

  const chainsRaw = await prisma.chain.findMany();

  const chains = chainsRaw.sort((a, b) => {
    if (a.name === "Chain A") return -1;
    if (b.name === "Chain A") return 1;
    if (a.name === "Chain B") return -1;
    if (b.name === "Chain B") return 1;
    return 0;
  });

  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const installed = chains.find((c) => c.isInstalled);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Bike Chain Wax Tracker</h1>

      <div className="mt-4 rounded-2xl border p-4">
        <p>
          Installed chain:{" "}
          <strong>{installed?.name ?? "None"}</strong>
        </p>
        <p className="mt-1">
          Switch threshold: <strong>{targetKm} km</strong>
        </p>
      </div>

      <p className="mt-3">
        <a
          href="/api/strava/auth"
          className="inline-block rounded-xl bg-orange-600 px-4 py-2 text-white"
        >
          Connect Strava
        </a>
      </p>

      

      {chains.length === 0 ? (
        <div className="mt-6">
          <form action={seedData}>
            <button
              type="submit"
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Create Chain A + Chain B
            </button>
          </form>
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border p-4">
            <h2 className="text-xl font-semibold">Add ride manually</h2>
            <form
              action={addRide}
              className="mt-4 flex flex-wrap items-center gap-3"
            >
              <input
                name="distanceKm"
                type="number"
                step="0.1"
                min="0"
                placeholder="Ride distance in km"
                required
                className="rounded-xl border px-3 py-2"
              />
              <button
                type="submit"
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Add ride
              </button>
            </form>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold">Chains</h2>

            <div className="mt-4 grid gap-4">
              {chains.map((chain) => {
                const percent = Math.min(100, (chain.kmSinceWax / targetKm) * 100);
                const needsSwitch =
                  chain.isInstalled && chain.kmSinceWax >= targetKm;
                const needsRewax =
                  !chain.isInstalled && chain.kmSinceWax >= targetKm;

                return (
                  <div
                      key={chain.id}
                      className={`rounded-2xl p-4 border ${
                        chain.isInstalled
                          ? "border-blue-500 ring-2 ring-blue-400"
                          : "border-gray-200"
                      }`}
                    >
                    <h3 className="text-lg font-semibold">
                      {chain.name} {chain.isInstalled ? "• installed" : ""}
                    </h3>

                    <p className="mt-2">Total km: {chain.totalKm.toFixed(1)}</p>
                    <p>Km since wax: {chain.kmSinceWax.toFixed(1)}</p>

                    <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={needsSwitch ? "h-full bg-red-500" : "h-full bg-black"}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {needsSwitch ? (
                      <p className="mt-3 font-semibold text-red-600">
                        Switch chains now.
                      </p>
                    ) : null}

                    {needsRewax ? (
                      <p className="mt-3 font-semibold text-amber-700">
                        This off-bike chain should be rewaxed.
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!chain.isInstalled ? (
                        <form action={switchChain}>
                          <input type="hidden" name="chainId" value={chain.id} />
                          <button
                            type="submit"
                            className="rounded-xl border px-4 py-2"
                          >
                            Switch to this chain
                          </button>
                        </form>
                      ) : null}

                      <form action={rewaxChain}>
                        <input type="hidden" name="chainId" value={chain.id} />
                        <button
                          type="submit"
                          className="rounded-xl border px-4 py-2"
                        >
                          Mark rewaxed
                        </button>
                      </form>
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium">
                        Edit starting km
                      </summary>

                      <form
                        action={updateStartingKm}
                        className="mt-3 grid max-w-sm gap-2"
                      >
                        <input type="hidden" name="chainId" value={chain.id} />

                        <input
                          name="totalKm"
                          type="number"
                          step="0.1"
                          defaultValue={chain.totalKm}
                          required
                          className="rounded-xl border px-3 py-2"
                        />

                        <input
                          name="kmSinceWax"
                          type="number"
                          step="0.1"
                          defaultValue={chain.kmSinceWax}
                          required
                          className="rounded-xl border px-3 py-2"
                        />

                        <button
                          type="submit"
                          className="rounded-xl bg-black px-4 py-2 text-white"
                        >
                          Save km
                        </button>
                      </form>
                    </details>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border p-4">
            <h2 className="text-xl font-semibold">Recent events</h2>
            <ul className="mt-3 space-y-2">
              {events.map((event) => (
                <li key={event.id}>
                  {new Date(event.createdAt).toLocaleString()} — {event.type} —{" "}
                  {event.details}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}