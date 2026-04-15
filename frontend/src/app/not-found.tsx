export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-2xl rounded-[20px] border border-[var(--line)] bg-white p-10 text-center shadow-[var(--shadow)]">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Not found
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--ink)]">This case is not public.</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The route may not exist, or the case is still pending review and therefore excluded from
          the public interface.
        </p>
        <a
          className="mt-6 inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--soft)] px-5 py-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--soft-strong)]"
          href="/"
        >
          Return to map
        </a>
      </div>
    </main>
  );
}
