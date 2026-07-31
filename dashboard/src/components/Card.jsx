import React, { useEffect, useId, useRef } from "react";
import { ResponsiveContainer } from "recharts";

import { Popover } from "./Controls.jsx";

function Info({ description }) {
  const id = useId();

  return (
    <span className="info-wrap">
      <button type="button" className="info" aria-label="More information" aria-describedby={id}
        onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.blur(); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 7v4M8 4.75v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <span id={id} className="info-tooltip" role="tooltip">{description}</span>
    </span>
  );
}

export function Card({
  id, title, queryId, kind = "chart", chart, wide, description, onOpen, onEdit, children,
}) {
  const component = { id, title, queryId, kind, chart };

  return (
    <section className={`panel${wide ? " wide" : ""}`} data-component-id={id} data-query-id={queryId}>
      <header className="panel-header">
        <h2 className={kind === "metric" ? "metric-title" : undefined}>
          {title}{description && <Info description={description} />}
        </h2>
        <Popover className="menu" label={`${title} actions`} trigger="⋯">
          {chart && <button type="button" role="menuitem"
            onClick={() => onOpen("explore", component)}>Explore this chart</button>}
          <button type="button" role="menuitem" onClick={() => onOpen("source", component)}>View calculation and source</button>
          {onEdit && <button type="button" role="menuitem" onClick={onEdit}>Edit text</button>}
        </Popover>
      </header>
      {children}
    </section>
  );
}

export function ChartCard({ children, height = 240, ...props }) {
  return (
    <Card {...props}>
      <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
    </Card>
  );
}

export function Dialog({ title, expanded, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog ref={ref} className={`dialog${expanded ? " expanded" : ""}`} aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <header className="dialog-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose} autoFocus>×</button>
      </header>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
