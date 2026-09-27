"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const modalStack: HTMLElement[] = [];
let originalOverflow = "";

export function useModalA11y(onClose: () => void, active = true) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement = dialog;
    if (!modalStack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(dialogElement);
    modalStack.sort((a,b)=>a.contains(b)?-1:b.contains(a)?1:0);

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusInitial = window.requestAnimationFrame(() => {
      if(modalStack.at(-1)!==dialogElement)return;
      const preferred = dialogElement.querySelector<HTMLElement>("[autofocus]");
      const first = dialogElement.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? (previouslyFocused && dialogElement.contains(previouslyFocused) ? previouslyFocused : null) ?? first ?? dialogElement).focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (modalStack.at(-1) !== dialogElement) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [...dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);

      if (!focusable.length) {
        event.preventDefault();
        dialogElement.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !dialogElement.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !dialogElement.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      const wasTop = modalStack.at(-1) === dialogElement;
      const index = modalStack.indexOf(dialogElement);
      if (index >= 0) modalStack.splice(index, 1);
      if (!modalStack.length) document.body.style.overflow = originalOverflow;
      window.cancelAnimationFrame(focusInitial);
      document.removeEventListener("keydown", onKeyDown, true);
      if (wasTop && previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [active]);

  return dialogRef;
}
