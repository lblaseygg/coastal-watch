import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import AdminScrollRestoration from "@/components/admin-scroll-restoration";
import PublicNav from "@/components/public-nav";
import { getMapMunicipalities, mapMunicipalitiesToRecords } from "@/lib/api";
import { getAdminManualCase } from "@/lib/admin-api";
import { createAdminCsrfToken, getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ManualCaseEditPageProps = {
  params: { id: string };
  searchParams?: { error?: string; success?: string };
};

export default async function ManualCaseEditPage({
  params,
  searchParams
}: ManualCaseEditPageProps) {
  const cookieStore = cookies();
  const adminSession = getAdminSession(cookieStore);
  const actor = adminSession?.actor;
  const csrfToken = adminSession ? createAdminCsrfToken(adminSession) : null;

  if (!actor) {
    redirect("/admin?error=session_expired");
  }

  const municipalities = mapMunicipalitiesToRecords(await getMapMunicipalities());

  let manualCase;
  try {
    manualCase = await getAdminManualCase(actor, params.id);
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
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Manual case
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight text-[var(--ink)]">
              Edit {manualCase.case.title}
            </h1>
          </div>
          <Link
            className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
            href="/admin"
          >
            Back to admin
          </Link>
        </div>

        {searchParams?.success ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            Manual case updated successfully.
          </div>
        ) : null}

        {searchParams?.error ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            {searchParams.error}
          </div>
        ) : null}

        <section className="panel px-6 py-6 md:px-8">
          <form action={`/admin/cases/${params.id}/edit/save`} className="grid gap-4" method="post">
            {csrfToken ? <input name="csrf_token" type="hidden" value={csrfToken} /> : null}
            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Case title
              <input className="admin-review-input" defaultValue={manualCase.case.title} name="title" required type="text" />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Summary of the article
              <textarea
                className="admin-review-textarea min-h-[220px]"
                defaultValue={manualCase.case.public_summary}
                name="summary"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Source title
              <input
                className="admin-review-input"
                defaultValue={manualCase.source?.title ?? ""}
                name="source_title"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Source link
              <input
                className="admin-review-input"
                defaultValue={manualCase.source?.url ?? ""}
                name="source_url"
                required
                type="url"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                First published
                <input
                  className="admin-review-input"
                  defaultValue={manualCase.case.first_reported_at.slice(0, 10)}
                  name="first_reported_at"
                  required
                  type="date"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Last updated
                <input
                  className="admin-review-input"
                  defaultValue={manualCase.case.last_updated_at.slice(0, 10)}
                  name="last_reported_at"
                  type="date"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Municipalities
            </label>
            <fieldset className="grid gap-2 rounded-[14px] border border-[var(--line)] bg-white p-4">
              <legend className="sr-only">Municipalities</legend>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Keep this case linked to every municipality where it should show on the map.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {municipalities.map((municipality) => (
                  <label className="flex items-center gap-3 text-sm text-[var(--ink)]" key={municipality.id}>
                    <input
                      className="h-4 w-4 rounded border-[var(--line)] text-[var(--ink)]"
                      defaultChecked={manualCase.case.municipality_ids.includes(municipality.id)}
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
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
