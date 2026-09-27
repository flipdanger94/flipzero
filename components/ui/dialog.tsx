"use client";

import { type ReactNode } from "react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

/** Mount only while open. Existing screen classes retain their layout. */
export function Dialog({
  children,
  onClose,
  className = "",
  backdropClassName = "dialog-backdrop",
  label,
  labelledBy,
  describedBy,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  const ref = useModalA11y(onClose);
  return (
    <div
      className={`${backdropClassName} ui-dialog-backdrop`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={`${className} ui-dialog`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </section>
    </div>
  );
}
