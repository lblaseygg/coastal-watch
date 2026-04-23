import Link from "next/link";
import { cookies } from "next/headers";
import { type AdminManualCaseRecord, type AdminReviewItemSummaryRecord, getAdminManualCases, getAdminReviewItems } from "@/lib/admin-api";
import { createAdminCsrfToken, createLoginCsrfToken, getAdminSession } from "@/lib/admin-session";
import AdminScrollRestoration from "@/components/admin-scroll-restoration";
import AdminCollapseButton from "@/components/admin-collapse-button";
import PublicNav from "@/components/public-nav";
import { getMapMunicipalities, mapMunicipalitiesToRecords } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const errorCopy: Record<string, string> = {
  invalid_credentials: "The admin token or reviewer name was not accepted.",
  missing_credentials: "Enter both a reviewer name and admin token.",
  missing_manual_case_fields: "Complete all manual case fields before saving.",
  session_expired: "The admin session expired. Sign in again.",
  logged_out: "You signed out of the admin review area."
};

const successCopy: Record<string, string> = {
  approve: "Review item approved and removed from the pending queue.",
  reject: "Review item rejected and removed from the pending queue.",
  needs_edit: "Review item marked for edits and removed from the pending queue.",
  manual_case_created: "Manual case created and published successfully.",
  manual_case_deleted: "Manual case deleted successfully.",
  manual_case_updated: "Manual case updated successfully."
};

type AdminPageProps = {
  searchParams?: {
    error?: string;
    logged_out?: string;
    success?: string;
    status?: string;
  };
};

const statusMeta: Record<
  string,
  { label: string; chipClassName: string; panelClassName: string; countClassName: string }
> = {
  pending_review: {
    label: "Pending review",
    chipClassName: "status-chip status-chip-pending",
    panelClassName: "admin-status-panel admin-status-panel-pending",
    countClassName: "admin-status-count admin-status-count-pending"
  },
  approved: {
    label: "Approved",
    chipClassName: "status-chip status-chip-approved",
    panelClassName: "admin-status-panel admin-status-panel-approved",
    countClassName: "admin-status-count admin-status-count-approved"
  },
  needs_edit: {
    label: "Needs edit",
    chipClassName: "status-chip status-chip-needs-edit",
    panelClassName: "admin-status-panel admin-status-panel-needs-edit",
    countClassName: "admin-status-count admin-status-count-needs-edit"
  },
  rejected: {
    label: "Rejected",
    chipClassName: "status-chip status-chip-rejected",
    panelClassName: "admin-status-panel admin-status-panel-rejected",
    countClassName: "admin-status-count admin-status-count-rejected"
  }
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const cookieStore = cookies();
  const adminSession = getAdminSession(cookieStore);
  const actor = adminSession?.actor;
  const loginCsrfToken = createLoginCsrfToken();
  const adminCsrfToken = adminSession ? createAdminCsrfToken(adminSession) : null;
  const statusFilter = searchParams?.status ?? "all";
  const flashMessage =
    searchParams?.error
      ? errorCopy[searchParams.error] ?? searchParams.error
      : searchParams?.logged_out
        ? errorCopy.logged_out
        : searchParams?.success
          ? successCopy[searchParams.success] ?? searchParams.success
          : null;

  let items: AdminReviewItemSummaryRecord[] = [];
  let allItems: AdminReviewItemSummaryRecord[] = [];
  let manualCases: AdminManualCaseRecord[] = [];
  let authFailed = false;
  const municipalities = mapMunicipalitiesToRecords(await getMapMunicipalities());

  if (actor) {
    try {
      [items, allItems, manualCases] = await Promise.all([
        getAdminReviewItems(actor, statusFilter),
        getAdminReviewItems(actor, "all"),
        getAdminManualCases(actor)
      ]);
    } catch {
      authFailed = true;
    }
  }

  if (!actor || authFailed) {
    return (
      <main className="page-shell">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <header className="hero-panel overflow-hidden py-4 md:py-5">
            <div className="flex flex-col gap-6">
              <div className="flex items-start justify-between gap-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                  Admin
                </p>

                <PublicNav activeHref="/admin" showAdmin />
              </div>
            </div>
          </header>

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
              {loginCsrfToken ? <input name="csrf_token" type="hidden" value={loginCsrfToken} /> : null}
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

  const pendingCount = allItems.filter((item) => item.status === "pending_review").length;
  const selectedHref = items[0] ? `/admin/review/${items[0].id}` : null;
  const statusCounts = {
    pending_review: allItems.filter((item) => item.status === "pending_review").length,
    approved: allItems.filter((item) => item.status === "approved").length,
    needs_edit: allItems.filter((item) => item.status === "needs_edit").length,
    rejected: allItems.filter((item) => item.status === "rejected").length
  };

  return (
    <main className="page-shell">
      <AdminScrollRestoration />
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-6">
        <header className="hero-panel overflow-hidden py-4 md:py-5">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                Admin
              </p>

              <PublicNav activeHref="/admin" showAdmin />
            </div>
          </div>
        </header>

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
              {adminCsrfToken ? <input name="csrf_token" type="hidden" value={adminCsrfToken} /> : null}
              <button
                className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </section>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(statusCounts).map(([statusKey, count]) => {
            const meta = statusMeta[statusKey];
            return (
              <div className={meta.panelClassName} key={statusKey}>
                <p className={meta.chipClassName}>{meta.label}</p>
                <p className={meta.countClassName}>{count}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {count === 1 ? "review item" : "review items"} currently in this state
                </p>
              </div>
            );
          })}
        </section>

        <section className="panel px-6 py-6 md:px-8">
          <details className="admin-collapsible-panel">
            <summary className="admin-collapsible-summary">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  Manual case entry
                </p>
                <h2 className="mt-2 text-[1.25rem] font-semibold leading-tight text-[var(--ink)]">
                  Create a case directly from reporting you want to track.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Add a case manually only when the automated pipeline missed it or when you want to publish a curated entry.
                </p>
              </div>
              <span className="admin-collapsible-trigger">Create manual case</span>
            </summary>

            <div className="admin-collapsible-content">
              <form action="/admin/cases/create" className="grid gap-4" method="post">
                {adminCsrfToken ? <input name="csrf_token" type="hidden" value={adminCsrfToken} /> : null}
                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Case title
                  <input className="admin-review-input" name="title" required type="text" />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Summary of the article
                  <textarea
                    className="admin-review-textarea min-h-[180px]"
                    name="summary"
                    placeholder="Summarize what is being built, blocked, or harmed, and why it matters."
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Source title
                  <input className="admin-review-input" name="source_title" required type="text" />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Source link
                  <input className="admin-review-input" name="source_url" required type="url" />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                    First published
                    <input className="admin-review-input" name="first_reported_at" required type="date" />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                    Last updated
                    <input className="admin-review-input" name="last_reported_at" type="date" />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Municipalities
                </label>
                <fieldset className="grid gap-2 rounded-[14px] border border-[var(--line)] bg-white p-4">
                  <legend className="sr-only">Municipalities</legend>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Select every municipality this manual case should appear in on the map.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {municipalities.map((municipality) => (
                      <label className="flex items-center gap-3 text-sm text-[var(--ink)]" key={municipality.id}>
                        <input
                          className="h-4 w-4 rounded border-[var(--line)] text-[var(--ink)]"
                          name="municipality_ids"
                          type="checkbox"
                          value={municipality.id}
                        />
                        <span>{municipality.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    className="rounded-[10px] border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                    type="submit"
                  >
                    Create case
                  </button>
                  <AdminCollapseButton />
                </div>
              </form>
            </div>
          </details>
        </section>

        <section className="panel px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Manual cases
              </p>
              <h2 className="mt-3 text-[1.5rem] font-semibold leading-tight text-[var(--ink)]">
                Delete admin-created cases without touching the database.
              </h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {manualCases.length} manual case{manualCases.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            {manualCases.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                No manual cases have been created yet.
              </p>
            ) : (
              manualCases.map((item) => (
                <article className="admin-manual-case-row" key={item.case.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold leading-6 text-[var(--ink)]">
                        {item.case.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {item.municipality_names.join(", ")} · {new Date(item.case.first_reported_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="admin-action-button admin-action-button-needs-edit admin-action-button-compact"
                        href={`/admin/cases/${item.case.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={`/admin/cases/${item.case.id}/delete`} method="post">
                        {adminCsrfToken ? <input name="csrf_token" type="hidden" value={adminCsrfToken} /> : null}
                        <button
                          className="admin-action-button admin-action-button-reject admin-action-button-compact"
                          type="submit"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="panel admin-filter-panel p-3">
            <div className="grid gap-2">
              {["all", "pending_review", "approved", "needs_edit", "rejected"].map((statusValue) => (
                <Link
                  className={`admin-filter-link ${
                    statusFilter === statusValue
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                  }`}
                  href={statusValue === "all" ? "/admin" : `/admin?status=${statusValue}`}
                  key={statusValue}
                  scroll={false}
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

            <div className="grid gap-3 p-4">
              {items.map((item) => (
                <Link
                  className="admin-review-card"
                  href={`/admin/review/${item.id}`}
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusMeta[item.status]?.chipClassName ?? "status-chip"}>
                      {statusMeta[item.status]?.label ?? item.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      {item.entity_type.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      {item.entity_id}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-base font-semibold leading-6 text-[var(--ink)]">
                      {item.entity_type.replaceAll("_", " ")} awaiting moderation
                    </p>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      {item.decision_notes ??
                        "Open this item to inspect the extracted article, review reasons, and moderation details."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    <span>{item.entity_type.replaceAll("_", " ")}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.reason_codes.map((reasonCode) => (
                      <span
                        className="admin-reason-pill"
                        key={reasonCode}
                      >
                        {reasonCode.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}

              {items.length === 0 ? (
                <div className="px-2 py-6 text-sm text-[var(--muted)]">
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
