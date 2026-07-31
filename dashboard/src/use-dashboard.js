import { useCallback, useEffect, useRef, useState } from "react";

export function useDashboard(snapshot) {
  const [queries, setQueries] = useState(snapshot.queries);
  const queriesRef = useRef(snapshot.queries);
  const [filters, setFilters] = useState(() => Object.fromEntries(
    (snapshot.filters ?? []).map(({ id, defaultValue }) => [id, defaultValue ?? "all"]),
  ));

  useEffect(() => {
    const context = document.modelContext ?? navigator.modelContext;
    if (typeof context?.registerTool !== "function") return;

    const tools = [{
      name: "list_dashboard_queries",
      description: "List reviewed dashboard queries, provenance, columns, and row counts.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: async () => Object.entries(queriesRef.current).map(([queryId, { rows, source }]) => ({
        queryId, label: source.label, sql: source.sql, tables: source.tables ?? [],
        columns: [...new Set(rows.flatMap(Object.keys))], rowCount: rows.length,
      })),
    }, {
      name: "update_dashboard_query",
      description: "Update reviewed dashboard query rows for this session.",
      inputSchema: {
        type: "object", properties: {
          queryId: { type: "string" },
          rows: { type: "array", maxItems: 10_000, items: { type: "object" } },
        },
        required: ["queryId", "rows"], additionalProperties: false,
      },
      execute: async ({ queryId, rows }) => {
        if (!Object.hasOwn(snapshot.queries, queryId) || !Array.isArray(rows)
          || rows.length > 10_000 || rows.some((row) => row === null || typeof row !== "object"
            || ![Object.prototype, null].includes(Object.getPrototypeOf(row)))) {
          throw new Error("Dashboard query or reviewed rows are invalid.");
        }
        queriesRef.current = {
          ...queriesRef.current, [queryId]: { ...queriesRef.current[queryId], rows },
        };
        setQueries(queriesRef.current);
        return { queryId, rowCount: rows.length };
      },
    }];

    tools.forEach((tool) => {
      const report = (error) => console.error(`Unable to register dashboard tool ${tool.name}.`, error);
      try {
        Promise.resolve(context.registerTool(tool)).catch(report);
      } catch (error) {
        report(error);
      }
    });
    return () => tools.forEach((tool) => context.unregisterTool?.(tool.name));
  }, [snapshot]);

  const setFilter = useCallback((id, value) => {
    setFilters((current) => ({ ...current, [id]: value }));
  }, []);

  const reviewedRows = useCallback((queryId, breakdown = []) => {
    let rows = queries[queryId]?.rows ?? [];
    const definitions = snapshot.filters ?? [];

    definitions.forEach(({ id, field }) => {
      if (filters[id] !== "all" && rows.some((row) => Object.hasOwn(row, field))) {
        const selected = filters[id];
        rows = rows.filter((row) => String(row[field]) === selected);
      }
    });

    definitions.forEach(({ id, field }) => {
      if (filters[id] === "all" && !breakdown.includes(field)
        && rows.some((row) => String(row[field] ?? "").toLowerCase() === "all")) {
        rows = rows.filter((row) => String(row[field]).toLowerCase() === "all");
      }
    });
    return rows;
  }, [filters, queries, snapshot]);

  const activeFilters = (snapshot.filters ?? [])
    .filter(({ id }) => filters[id] !== "all")
    .map(({ id, field, label }) => ({ field, label, value: filters[id] }));

  return { queries, filters, setFilter, reviewedRows, activeFilters };
}
