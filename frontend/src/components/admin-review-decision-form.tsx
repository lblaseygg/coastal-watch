"use client";

import { FormEvent, useState } from "react";

type AdminReviewDecisionFormProps = {
  actionUrl: string;
  actor: string;
  csrfToken: string;
  assignedTo: string | null;
  decisionNotes: string | null;
  extractedSummary: string;
  editableFields: string[];
};

export function AdminReviewDecisionForm({
  actionUrl,
  actor,
  csrfToken,
  assignedTo,
  decisionNotes,
  extractedSummary,
  editableFields
}: AdminReviewDecisionFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const submitEvent = event.nativeEvent;
    const submitter =
      submitEvent instanceof SubmitEvent ? (submitEvent.submitter as HTMLElement | null) : null;
    const formData =
      submitter instanceof HTMLButtonElement ? new FormData(form, submitter) : new FormData(form);

    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        body: formData,
        cache: "no-store"
      });

      window.location.assign(response.url);
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(error instanceof Error ? error.message : "Unable to save review decision");
    }
  }

  return (
    <form action={actionUrl} className="mt-5 grid gap-5" method="post" onSubmit={handleSubmit}>
      <input name="csrf_token" type="hidden" value={csrfToken} />
      <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
        Assign reviewer
        <input
          className="admin-review-input"
          defaultValue={assignedTo ?? actor}
          name="assigned_to"
          type="text"
        />
      </label>

      {editableFields.includes("extracted_summary") ? (
        <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
          Edited public summary
          <textarea
            className="admin-review-textarea min-h-[210px]"
            defaultValue={extractedSummary}
            name="edited_summary"
            placeholder="Tighten the public summary so it states the location, the disputed activity, and the public impact in neutral language."
          />
        </label>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
        Reviewer note
        <textarea
          className="admin-review-textarea min-h-[160px]"
          defaultValue={decisionNotes ?? ""}
          name="note"
          placeholder="Explain the moderation decision or summarize what changed."
        />
      </label>

      {errorMessage ? (
        <div className="rounded-[14px] border border-[var(--line)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--ink)]">
          {errorMessage}
        </div>
      ) : null}

      <div className="admin-decision-actions">
        <button
          className="admin-action-button admin-action-button-approve"
          disabled={isSubmitting}
          name="action"
          type="submit"
          value="approve"
        >
          {isSubmitting ? "Saving..." : "Approve"}
        </button>
        <button
          className="admin-action-button admin-action-button-needs-edit"
          disabled={isSubmitting}
          name="action"
          type="submit"
          value="needs_edit"
        >
          {isSubmitting ? "Saving..." : "Needs edit"}
        </button>
        <button
          className="admin-action-button admin-action-button-reject"
          disabled={isSubmitting}
          name="action"
          type="submit"
          value="reject"
        >
          {isSubmitting ? "Saving..." : "Reject"}
        </button>
      </div>
    </form>
  );
}
