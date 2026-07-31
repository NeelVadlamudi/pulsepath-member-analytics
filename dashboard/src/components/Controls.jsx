import React, { useEffect, useRef, useState } from "react";

export function Popover({ className, label, role = "menu", trigger, children }) {
  const details = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!details.current?.contains(event.target)) details.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const onKeyDown = (event) => {
    const element = event.currentTarget;
    if (event.key === "Escape") {
      element.removeAttribute("open");
      element.querySelector("summary")?.focus();
      event.preventDefault();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const options = [...element.querySelectorAll(".popover button:not([disabled])")];
    if (!options.length) return;
    event.preventDefault();
    element.open = true;
    const current = options.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : event.key === "ArrowUp" ? (current <= 0 ? options.length - 1 : current - 1)
        : (current + 1) % options.length;
    options[next].focus();
  };

  return (
    <details ref={details} name="dashboard-popover" className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)} onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open");
      }}>
      <summary aria-label={label} aria-haspopup={role} aria-expanded={open}>{trigger}</summary>
      <div className="popover" role={role} aria-label={label}
        onClick={() => details.current?.removeAttribute("open")}>
        {children}
      </div>
    </details>
  );
}

export function Dropdown({ label, value, choices, onChange, showLabel = false, formatChoice }) {
  const display = (choice) => {
    if (choice === "all") return "All";
    if (choice === "") return "No series";
    return formatChoice ? formatChoice(choice) : choice;
  };

  return (
    <Popover className="filter" label={label} role="listbox" trigger={<>
      {showLabel && <span className="filter-label">{label}</span>}
      <span>{display(value)}</span><span className="chevron">⌄</span>
    </>}>
      {choices.map((choice) => (
        <button type="button" key={choice} role="option" aria-selected={value === choice}
          onClick={() => onChange(choice)}>
          {display(choice)}{value === choice && "✓"}
        </button>
      ))}
    </Popover>
  );
}

export function Filters({ filters = [], queries, values, onChange }) {
  if (!filters.length) return null;

  return (
    <section className="filters" aria-label="Dashboard filters">
      {filters.map((filter) => {
        const choices = [...new Set(Object.values(queries).flatMap(({ rows }) => rows
          .map((row) => String(row[filter.field] ?? ""))
          .filter((value) => value && value.toLowerCase() !== "all")))];
        if (/(?:date|day|week|month|quarter|year|period|time)/i.test(filter.field)) {
          choices.sort((left, right) => {
            const leftDate = Date.parse(left);
            const rightDate = Date.parse(right);
            return Number.isFinite(leftDate) && Number.isFinite(rightDate)
              ? rightDate - leftDate : right.localeCompare(left, undefined, { numeric: true });
          });
        }

        return (
          <Dropdown key={filter.id} label={filter.label} value={values[filter.id]}
            choices={["all", ...choices]} onChange={(choice) => onChange(filter.id, choice)} showLabel />
        );
      })}
    </section>
  );
}

export function DataTable({ rows, searchable = true }) {
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState({ field: "", descending: false });
  const [page, setPage] = useState(0);
  const columns = [...new Set(rows.flatMap(Object.keys))];
  const visible = rows.filter((row) => Object.values(row).some((value) =>
    String(value).toLowerCase().includes(search.toLowerCase()))).sort((left, right) => {
    if (!order.field) return 0;
    return String(left[order.field]).localeCompare(String(right[order.field]), undefined, {
      numeric: true,
    }) * (order.descending ? -1 : 1);
  });
  const pages = Math.max(1, Math.ceil(visible.length / 8));
  const currentPage = Math.min(page, pages - 1);

  return (
    <>
      {searchable && (
        <div className="toolbar">
          <input className="search" aria-label="Search data" placeholder="Search data" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
          <span className="source-value">{visible.length} results</span>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead><tr>{columns.map((column) => (
            <th key={column}><button type="button" onClick={() => setOrder({
              field: column, descending: order.field === column && !order.descending,
            })}>{column}{order.field === column ? (order.descending ? " ↓" : " ↑") : ""}</button></th>
          ))}</tr></thead>
          <tbody>{visible.slice(currentPage * 8, currentPage * 8 + 8).map((row, index) => (
            <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="toolbar">
          <span className="source-value">Page {currentPage + 1} of {pages}</span>
          <div className="actions">
            <button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <button type="button" disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
