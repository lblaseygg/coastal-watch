import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAdminReviewItem } from "@/lib/admin-api";
import AdminScrollRestoration from "@/components/admin-scroll-restoration";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { AdminReviewDecisionForm } from "@/components/admin-review-decision-form";
import PublicNav from "@/components/public-nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReviewDetailPageProps = {
  params: { id: string };
  searchParams?: { error?: string; success?: string };
};

const statusMeta: Record<string, { label: string; chipClassName: string }> = {
  pending_review: { label: "Pending review", chipClassName: "status-chip status-chip-pending" },
  approved: { label: "Approved", chipClassName: "status-chip status-chip-approved" },
  needs_edit: { label: "Needs edit", chipClassName: "status-chip status-chip-needs-edit" },
  rejected: { label: "Rejected", chipClassName: "status-chip status-chip-rejected" }
};

export default async function ReviewDetailPage({ params, searchParams }: ReviewDetailPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;

  if (!token || !actor) {
    redirect("/admin?error=session_expired");
  }

  let item;
  try {
    item = await getAdminReviewItem(token, actor, params.id);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401) {
      redirect("/admin?error=session_expired");
    }
    if (status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="page-shell">
      <AdminScrollRestoration />
      <div className="mx-auto flex max-w-[1260px] flex-col gap-6">
        <header className="hero-panel overflow-hidden py-4 md:py-5">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                Admin
              </p>

              <PublicNav activeHref="/admin" />
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Review item
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight text-[var(--ink)]">
              {item.id}
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
              href="/admin"
            >
              Back to queue
            </Link>
          </div>
        </div>

        {searchParams?.success ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            Review item saved with action: {searchParams.success.replaceAll("_", " ")}.
          </div>
        ) : null}

        {searchParams?.error ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            {searchParams.error}
          </div>
        ) : null}

        <section className="admin-review-detail-grid">
          <div className="admin-review-detail-main">
            <section className="panel overflow-hidden px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusMeta[item.status]?.chipClassName ?? "status-chip"}>
                  {statusMeta[item.status]?.label ?? item.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  {item.entity_type.replaceAll("_", " ")}
                </span>
                <span className="min-w-0 break-all text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  {item.entity_id}
                </span>
              </div>
              <h2 className="mt-4 break-words text-2xl font-semibold text-[var(--ink)]">
                {item.extraction?.extracted_case_title ?? "Queued review item"}
              </h2>
              <p className="mt-4 break-words text-sm leading-7 text-[var(--muted)]">
                {item.extraction?.extracted_summary ?? item.decision_notes ?? "No extracted summary available."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {item.reason_codes.map((reasonCode) => (
                  <span
                    className="admin-reason-pill"
                    key={reasonCode}
                  >
                    {reasonCode.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </section>

            <section className="panel overflow-hidden px-6 py-6">
              <h3 className="text-lg font-semibold text-[var(--ink)]">Decision</h3>
              <AdminReviewDecisionForm
                actionUrl={`/admin/review/${item.id}/decision`}
                actor={actor}
                assignedTo={item.assigned_to}
                decisionNotes={item.decision_notes}
                editableFields={item.editable_fields}
                extractedSummary={item.extraction?.extracted_summary ?? ""}
              />
              {item.article && item.extraction && item.linked_case ? (
                <div className="mt-4">
                  <Link
                    className="inline-flex rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                    href={`/admin/review/${item.id}/edit`}
                  >
                    Edit automated case
                  </Link>
                </div>
              ) : null}
            </section>

            {item.article ? (
              <section className="panel overflow-hidden px-6 py-6">
                <h3 className="text-lg font-semibold text-[var(--ink)]">Source article</h3>
                <div className="mt-4 grid gap-4">
                  <div>
                    <p className="break-words text-sm font-medium text-[var(--ink)]">{item.article.title}</p>
                    <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                      {item.article.publisher} · {new Date(item.article.published_at).toLocaleDateString()}
                    </p>
                    <a
                      className="mt-3 inline-flex text-sm font-medium text-[var(--ink)] underline underline-offset-4"
                      href={item.article.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source
                    </a>
                  </div>
                  <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      Cleaned text
                    </p>
                    <p className="mt-3 break-words text-sm leading-7 text-[var(--muted)]">
                      {item.article.cleaned_text}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="admin-review-detail-side">
            {item.linked_case ? (
              <section className="panel overflow-hidden px-6 py-6">
                <h3 className="text-lg font-semibold text-[var(--ink)]">Linked case</h3>
                <p className="mt-4 break-words text-base font-medium text-[var(--ink)]">{item.linked_case.title}</p>
                <p className="mt-2 break-words text-sm leading-6 text-[var(--muted)]">
                  Municipality: {item.linked_case.municipality_id} · Status: {item.linked_case.status}
                </p>
                <p className="mt-4 break-words text-sm leading-7 text-[var(--muted)]">
                  {item.linked_case.public_summary}
                </p>
                <Link
                  className="mt-4 inline-flex rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                  href={`/cases/${item.linked_case.slug}`}
                >
                  Open public case
                </Link>
              </section>
            ) : null}

            {item.extraction ? (
              <section className="panel overflow-hidden px-6 py-6">
                <h3 className="text-lg font-semibold text-[var(--ink)]">Extraction details</h3>
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      Model
                    </p>
                    <p className="mt-2 break-words text-sm text-[var(--ink)]">{item.extraction.model_name}</p>
                  </div>
                  <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      Confidence
                    </p>
                    <p className="mt-2 text-sm text-[var(--ink)]">
                      {(item.extraction.confidence_score * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      Editable fields
                    </p>
                    <p className="mt-2 break-words text-sm text-[var(--ink)]">
                      {item.editable_fields.join(", ")}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="panel overflow-hidden px-6 py-6">
              <h3 className="text-lg font-semibold text-[var(--ink)]">Audit trail</h3>
              <div className="mt-4 grid gap-4">
                {item.audit_events.map((event) => (
                  <div
                    className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4"
                    key={`${event.action}-${event.at}`}
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                      {event.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 break-words text-sm font-medium text-[var(--ink)]">{event.actor_id}</p>
                    <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">
                      {new Date(event.at).toLocaleString()}
                    </p>
                    {event.note ? (
                      <p className="mt-3 break-words text-sm leading-7 text-[var(--muted)]">{event.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
