import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-[var(--line)] bg-white/80 p-10 text-center shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--tide)]">
          Not found
        </p>
        <h1 className="mt-3 font-serif text-4xl text-[var(--ink)]">This case is not public.</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          The route may not exist, or the case is still pending review and therefore excluded from
          the public interface.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-[var(--ink)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--tide)]"
          href="/"
        >
          Return to map
        </Link>
      </div>
    </main>
  );
}
