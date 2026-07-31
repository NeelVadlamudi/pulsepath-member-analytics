import React, { useId, useState } from "react";

import { DataTable } from "./Controls.jsx";

export function SourceInspector({ component, query, rows, filters, generatedAt }) {
  const id = useId();
  const [tab, setTab] = useState("Overview");
  const { source } = query;
  const tables = source.tables ?? [];
  const tabs = ["Overview", "Data preview", "SQL query"];
  const selected = tabs.indexOf(tab);
  const activeFilters = filters.filter(({ field }) => query.rows.some((row) => Object.hasOwn(row, field)))
    .map(({ label, value }) => `${label}: ${value}`);

  return (
    <>
      <nav className="source-tabs" role="tablist" aria-label="Data source sections"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
            : (selected + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[next]);
          event.currentTarget.querySelectorAll("[role=tab]")[next]?.focus();
        }}>
        {tabs.map((name, index) => (
          <button type="button" role="tab" key={name} id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`} aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}>{name}</button>
        ))}
      </nav>

      {tabs.map((name, index) => (
        <section key={name} role="tabpanel" id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`} hidden={tab !== name} tabIndex={tab === name ? 0 : -1}>
          {tab === name && name === "Overview" && (
            <>
              <div className="source-grid">
                <div><p className="source-label">Component</p><p className="source-value">{component.title}</p></div>
                <div><p className="source-label">Dataset</p><p className="source-value">{component.queryId}</p></div>
                <div><p className="source-label">Data snapshot</p>
                  <p className="source-value">{new Date(generatedAt).toLocaleString()}</p></div>
                {!!tables.length && <div><p className="source-label">Tables used</p>
                  <p className="source-value">{tables.join(", ")}</p></div>}
                {!!source.filters?.length && <div><p className="source-label">Source filters</p>
                  <p className="source-value">{source.filters.join(", ")}</p></div>}
                {!!activeFilters.length && <div><p className="source-label">Active dashboard filters</p>
                  <p className="source-value">{activeFilters.join(", ")}</p></div>}
              </div>
              {!!source.metricDefinitions?.length && (
                <div className="definitions"><DataTable searchable={false} rows={source.metricDefinitions} /></div>
              )}
            </>
          )}

          {tab === name && name === "Data preview" && <DataTable rows={rows} />}

          {tab === name && name === "SQL query" && (
            <>
              <div className="toolbar"><span>{source.label}</span>
                {source.sql && <button type="button" className="copy-button"
                  onClick={() => navigator.clipboard?.writeText(source.sql)}>Copy query</button>}
              </div>
              <pre className="sql">{(source.sql ?? "No reviewed SQL provided.")
                .split(/(\b(?:SELECT|FROM|WHERE|AS|ORDER BY|GROUP BY|JOIN|AND|DATE)\b)/gi)
                .map((part, partIndex) => (
                  <span className={partIndex % 2 ? "sql-keyword" : undefined} key={partIndex}>{part}</span>
                ))}</pre>
            </>
          )}
        </section>
      ))}
    </>
  );
}
