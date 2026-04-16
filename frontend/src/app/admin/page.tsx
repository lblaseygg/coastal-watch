import Link from "next/link";
import { cookies } from "next/headers";
import { type AdminReviewItemSummaryRecord, getAdminReviewItems } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";

const errorCopy: Record<string, string> = {
  invalid_credentials: "The admin token or reviewer name was not accepted.",
  missing_credentials: "Enter both a reviewer name and admin token.",
  session_expired: "The admin session expired. Sign in again.",
  logged_out: "You signed out of the admin review area."
};

type AdminPageProps = {
  searchParams?: {
    error?: string;
    logged_out?: string;
    status?: string;
  };
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;
  const statusFilter = searchParams?.status ?? "all";
  const flashMessage = searchParams?.error
    ? errorCopy[searchParams.error] ?? searchParams.error
    : searchParams?.logged_out
      ? errorCopy.logged_out
      : null;

  let items: AdminReviewItemSummaryRecord[] = [];
  let authFailed = false;

  if (token && actor) {
    try {
      items = await getAdminReviewItems(token, actor, statusFilter);
    } catch {
      authFailed = true;
    }
  }

  if (!token || !actor || authFailed) {
    return (
      <main className="page-shell">
        <div className="mx-auto max-w-[780px]">
          <section className="panel px-8 py-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Admin review
            </p>
            <h1 className="mt-4 text-[2rem] font-semibold leading-tight text-[var(--ink)]">
              Review queued items before they become public.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
              This area is protected by a bearer token. Sign in with the current admin token and
              your reviewer name to moderate staged extractions.
            </p>

            {flashMessage ? (
              <div className="mt-6 rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
                {flashMessage}
              </div>
            ) : null}

            <form action="/admin/login" className="mt-8 grid gap-4" method="post">
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Reviewer name
                <input
                  className="rounded-[12px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--ink)]"
                  name="actor"
                  placeholder="e.g. maria.reviewer"
                  required
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Admin token
                <input
                  className="rounded-[12px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--ink)]"
                  name="token"
                  placeholder="Enter the bearer token"
                  required
                  type="password"
                />
              </label>

              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  className="rounded-[10px] border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  type="submit"
                >
                  Sign in
                </button>
                <Link
                  className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                  href="/"
                >
                  Return to public map
                </Link>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const pendingCount = items.filter((item) => item.status === "pending_review").length;
  const selectedHref = items[0] ? `/admin/review/${items[0].id}` : null;

  return (
    <main className="page-shell">
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_340px]">
          <section className="panel px-6 py-7 md:px-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Admin review
            </p>
            <h1 className="mt-4 text-[2rem] font-semibold leading-tight text-[var(--ink)] md:text-[3rem]">
              Moderate staged extractions before publication.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
              The worker can stage uncertain or sensitive extractions, but this queue determines
              what actually becomes public. Reviewers can approve, reject, or mark items for edits.
            </p>
          </section>

          <section className="panel flex flex-col gap-4 px-6 py-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Signed in as
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{actor}</p>
            </div>
            <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Pending review
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{pendingCount}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                queued items currently awaiting a decision
              </p>
            </div>
            <form action="/admin/logout" method="post">
              <button
                className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </section>
        </header>

        <section className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="panel p-3">
            <div className="grid gap-2">
              {["all", "pending_review", "approved", "needs_edit", "rejected"].map((statusValue) => (
                <Link
                  className={`rounded-[12px] px-4 py-3 text-sm font-medium transition ${
                    statusFilter === statusValue
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                  }`}
                  href={statusValue === "all" ? "/admin" : `/admin?status=${statusValue}`}
                  key={statusValue}
                >
                  {statusValue.replaceAll("_", " ")}
                </Link>
              ))}
            </div>
          </aside>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-4">
              <p className="text-sm font-medium text-[var(--muted)]">
                {items.length} review item{items.length === 1 ? "" : "s"} visible
              </p>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {items.map((item) => (
                <Link
                  className="grid gap-3 px-6 py-5 transition hover:bg-[var(--soft)]"
                  href={`/admin/review/${item.id}`}
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    <span>{item.status.replaceAll("_", " ")}</span>
                    <span>&bull;</span>
                    <span>{item.entity_type.replaceAll("_", " ")}</span>
                    <span>&bull;</span>
                    <span>{item.entity_id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.reason_codes.map((reasonCode) => (
                      <span
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]"
                        key={reasonCode}
                      >
                        {reasonCode.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}

              {items.length === 0 ? (
                <div className="px-6 py-8 text-sm text-[var(--muted)]">
                  No review items match the current filter.
                </div>
              ) : null}
            </div>
          </section>
        </section>

        {selectedHref ? (
          <div className="flex justify-end">
            <Link
              className="rounded-[10px] border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              href={selectedHref}
            >
              Open latest item
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
