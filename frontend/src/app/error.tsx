"use client";

export default function ErrorPage() {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-[var(--line)] bg-white/80 p-10 text-center shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--tide)]">
          API unavailable
        </p>
        <h1 className="mt-3 font-serif text-4xl text-[var(--ink)]">
          The frontend could not reach the backend.
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          Start the API on port <code>8000</code>, or set <code>API_BASE_URL</code> for the
          frontend environment.
        </p>
      </div>
    </main>
  );
}
