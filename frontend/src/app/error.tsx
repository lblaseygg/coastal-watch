"use client";

export default function ErrorPage() {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-2xl rounded-[20px] border border-[var(--line)] bg-white p-10 text-center shadow-[var(--shadow)]">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          API unavailable
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--ink)]">
          The frontend could not reach the backend.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Start the API on port <code>8000</code>, or set <code>API_BASE_URL</code> for the
          frontend environment.
        </p>
      </div>
    </main>
  );
}
