import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenEyes — one witness can lie, five cannot",
  description:
    "Verify whether real-world events actually happened, by corroboration across independent recordings.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0a0e14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-edge border-b">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-eye text-xl">◉</span> OpenEyes
            </Link>
            <div className="text-mist flex items-center gap-6 text-sm">
              <Link href="/events" className="hover:text-white">
                Events
              </Link>
              <Link
                href="/capture"
                className="bg-eye rounded-full px-4 py-1.5 font-medium text-black hover:opacity-90"
              >
                Capture
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="border-edge text-mist mt-16 border-t">
          <div className="mx-auto max-w-5xl px-6 py-6 text-xs">
            OpenEyes · UN SDG 16 — Peace, Justice and Strong Institutions · We
            don&apos;t build the truth, we build the ground it can stand on
            again.
          </div>
        </footer>
      </body>
    </html>
  );
}
