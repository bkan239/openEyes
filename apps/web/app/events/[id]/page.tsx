import { notFound } from "next/navigation";
import { MultiAnglePlayer } from "@/components/MultiAnglePlayer";
import { TrustScore } from "@/components/TrustScore";
import { getEvent } from "@/lib/api";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <span className="text-mist text-sm">
          {event.location?.label} ·{" "}
          {new Date(event.occurredAt).toLocaleString()}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="text-mist mb-3 text-sm font-medium uppercase tracking-wide">
            Every angle, in sync
          </h2>
          <MultiAnglePlayer clips={event.clips} />
        </section>

        <aside>
          <TrustScore trust={event.trust} />
        </aside>
      </div>
    </div>
  );
}
