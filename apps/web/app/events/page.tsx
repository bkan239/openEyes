import Link from "next/link";
import { listEvents } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  verified: "text-trust-high",
  pending: "text-trust-medium",
  disputed: "text-trust-low",
};

export default async function EventsPage() {
  const events = await listEvents();

  return (
    <div>
      <h1 className="text-2xl font-bold">Verified events</h1>
      <p className="text-mist mt-1 text-sm">
        Each event proves itself: independent angles, audio-synced, with an
        explainable trust score.
      </p>

      <ul className="mt-6 space-y-3">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="border-edge bg-surface flex items-center justify-between rounded-xl border p-5 hover:bg-white/5"
            >
              <div>
                <div className="font-semibold">{event.title}</div>
                <div className="text-mist mt-1 text-xs">
                  {event.location?.label ?? "Location unknown"} ·{" "}
                  {event.clips.length} angle
                  {event.clips.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {Math.round(event.trust.score * 100)}%
                </div>
                <div
                  className={`text-xs capitalize ${STATUS_COLOR[event.status] ?? "text-mist"}`}
                >
                  {event.status}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {events.length === 0 && (
          <li className="text-mist text-sm">
            No events yet — upload corroborating clips to create one.
          </li>
        )}
      </ul>
    </div>
  );
}
