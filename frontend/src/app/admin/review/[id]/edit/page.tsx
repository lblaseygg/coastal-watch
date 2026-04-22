import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import AdminScrollRestoration from "@/components/admin-scroll-restoration";
import PublicNav from "@/components/public-nav";
import { getMapMunicipalities, mapMunicipalitiesToRecords } from "@/lib/api";
import { getAdminReviewItem } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AutomatedReviewEditPageProps = {
  params: { id: string };
  searchParams?: { error?: string; success?: string };
};

export default async function AutomatedReviewEditPage({
  params,
  searchParams
}: AutomatedReviewEditPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;

  if (!token || !actor) {
    redirect("/admin?error=session_expired");
  }

  const municipalities = mapMunicipalitiesToRecords(await getMapMunicipalities());

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

  if (!item.article || !item.extraction || !item.linked_case) {
    notFound();
  }

  const { article, extraction, linked_case: linkedCase } = item;

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

              <PublicNav activeHref="/admin" />
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Automated case
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight text-[var(--ink)]">
              Edit {item.linked_case.title}
            </h1>
          </div>
          <Link
            className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
            href={`/admin/review/${params.id}`}
          >
            Back to review item
          </Link>
        </div>

        {searchParams?.success ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            Automated case updated successfully.
          </div>
        ) : null}

        {searchParams?.error ? (
          <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
            {searchParams.error}
          </div>
        ) : null}

        <section className="panel px-6 py-6 md:px-8">
          <form action={`/admin/review/${params.id}/edit/save`} className="grid gap-4" method="post">
            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Case title
              <input
                className="admin-review-input"
                defaultValue={linkedCase.title}
                name="title"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Public summary
              <textarea
                className="admin-review-textarea min-h-[220px]"
                defaultValue={linkedCase.public_summary}
                name="summary"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Source title
              <input
                className="admin-review-input"
                defaultValue={article.title}
                name="source_title"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Source link
              <input
                className="admin-review-input"
                defaultValue={article.url}
                name="source_url"
                required
                type="url"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Category
              <input
                className="admin-review-input"
                defaultValue={extraction.category}
                name="category"
                required
                type="text"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
              Municipalities
            </label>
            <fieldset className="grid gap-2 rounded-[14px] border border-[var(--line)] bg-white p-4">
              <legend className="sr-only">Municipalities</legend>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Keep this automated case linked to every municipality where it should show on the map.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {municipalities.map((municipality) => (
                  <label className="flex items-center gap-3 text-sm text-[var(--ink)]" key={municipality.id}>
                    <input
                      className="h-4 w-4 rounded border-[var(--line)] text-[var(--ink)]"
                      defaultChecked={linkedCase.municipality_ids.includes(municipality.id)}
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
