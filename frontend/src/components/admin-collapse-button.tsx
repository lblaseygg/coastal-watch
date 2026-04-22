"use client";

type AdminCollapseButtonProps = {
  label?: string;
};

export default function AdminCollapseButton({
  label = "Collapse"
}: AdminCollapseButtonProps) {
  return (
    <button
      className="admin-collapse-button"
      onClick={(event) => {
        const details = event.currentTarget.closest("details");
        if (details) {
          details.open = false;
        }
      }}
      type="button"
    >
      {label}
    </button>
  );
}
