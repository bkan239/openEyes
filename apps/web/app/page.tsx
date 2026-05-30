import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <section className="py-12">
        <p className="text-eye text-sm font-medium tracking-wide">
          UN SDG 16 · Open Innovation
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          One witness can lie.
          <br />
          Five cannot.
        </h1>
        <p className="text-mist mt-5 max-w-2xl text-lg">
          OpenEyes verifies whether real-world events actually happened — by
          corroboration instead of single-source detection. We turn scattered,
          independent recordings into one verifiable event.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/capture"
            className="bg-eye rounded-full px-6 py-3 font-medium text-black hover:opacity-90"
          >
            Capture a clip
          </Link>
          <Link
            href="/events"
            className="border-edge rounded-full border px-6 py-3 font-medium hover:bg-white/5"
          >
            Browse verified events
          </Link>
        </div>
      </section>

      <section className="border-edge bg-surface mt-8 rounded-2xl border p-6">
        <div className="text-mist grid grid-cols-1 gap-4 text-sm sm:grid-cols-4">
          {[
            ["Capture", "Signed metadata at the moment of recording"],
            ["Match", "Audio sync groups clips of the same moment"],
            ["Score", "An explainable trust score, not a yes/no"],
            ["Show", "One public event page, every angle"],
          ].map(([title, body]) => (
            <div key={title}>
              <div className="font-semibold text-white">{title}</div>
              <div className="mt-1">{body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
