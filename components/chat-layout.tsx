"use client";

import { type ReactNode } from "react";

export function ChatLayout({
  header,
  feed,
  composer,
  className = "",
}: {
  header?: ReactNode;
  feed: ReactNode;
  composer: ReactNode;
  className?: string;
}) {
  return (
    <section className={`chat-layout ${className}`}>
      {header ? <div className="chat-layout-header">{header}</div> : null}
      <div className="chat-layout-feed">{feed}</div>
      <div className="chat-layout-composer">{composer}</div>
    </section>
  );
}
