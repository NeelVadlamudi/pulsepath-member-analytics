import React, { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Funnel, FunnelChart,
  LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

import { DataTable, Dropdown } from "./Controls.jsx";

const chartTypes = [
  "line", "area", "stackedArea", "bar", "horizontalBar", "stackedBar", "stackedBar100",
  "horizontalStackedBar", "horizontalStackedBar100", "histogram", "scatter", "heatmap",
  "pie", "leaderboard", "sparkline", "funnel", "waterfall", "boxPlot",
];

export const colors = ["#3298ff", "#a8411c", "#8151db", "#15a596", "#d48a28"];

export const shortDate = (value) => new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", timeZone: "UTC",
}).format(new Date(value));

export const compact = (value) => new Intl.NumberFormat(undefined, {
  notation: "compact", maximumFractionDigits: 1,
}).format(value);

export const percentage = (value) => new Intl.NumberFormat(undefined, {
  style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero",
}).format(value);

export function pivot(rows, x, group, value) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row[x])) grouped.set(row[x], { [x]: row[x] });
    grouped.get(row[x])[row[group]] = row[value];
  });
  return [...grouped.values()];
}

function quantile(values, fraction) {
  const index = (values.length - 1) * fraction;
  const lower = Math.floor(index);
  return values[lower] + (values[Math.ceil(index)] - values[lower]) * (index - lower);
}

export function HeatCell({ cx, cy, payload }) {
  return <rect x={cx - 20} y={cy - 14} width={40} height={28} rx={5}
    fill={`rgb(50 152 255 / ${Math.max(0.17, payload.intensity)})`} />;
}

export function BoxShape({ x, y, width, height, payload }) {
  const ratio = height / Math.max(1, payload.upperQuartile - payload.lowerQuartile);
  const center = x + width / 2;
  const top = y - (payload.maximum - payload.upperQuartile) * ratio;
  const bottom = y + height + (payload.lowerQuartile - payload.minimum) * ratio;
  const median = y + (payload.upperQuartile - payload.median) * ratio;
  return <g stroke={colors[0]} strokeWidth={2}>
    <line x1={center} x2={center} y1={top} y2={bottom} />
    <line x1={center - 11} x2={center + 11} y1={top} y2={top} />
    <line x1={center - 11} x2={center + 11} y1={bottom} y2={bottom} />
    <rect x={x} y={y} width={width} height={height} rx={3} fill="var(--surface)" />
    <line x1={x} x2={x + width} y1={median} y2={median} />
  </g>;
}

export function ChartExplorer({ component, rows }) {
  const columns = [...new Set(rows.flatMap(Object.keys))];
  const numeric = columns.filter((column) => rows.some((row) =>
    typeof row[column] === "number" && Number.isFinite(row[column])));
  const initial = {
    type: component.chart.type,
    x: component.chart.x,
    y: component.chart.y,
    fields: component.chart.fields ?? [component.chart.y],
    series: component.chart.series ?? "",
  };
  const [options, setOptions] = useState(initial);
  const update = (field) => (value) => setOptions((current) => ({
    ...current,
    [field]: value,
    ...(field === "y" ? { fields: [value] } : {}),
    ...(field === "x" && value === current.series ? { series: "" } : {}),
  }));
  const horizontal = options.type === "horizontalBar" || options.type === "leaderboard"
    || options.type.startsWith("horizontalStacked");
  const stacked = options.type.toLowerCase().includes("stacked");
  const proportional = options.type.endsWith("100");
  const seriesValues = options.series
    ? [...new Set(rows.map((row) => row[options.series]).filter((value) => value != null))]
    : [];
  const data = seriesValues.length ? pivot(rows, options.x, options.series, options.y) : rows;
  const fields = seriesValues.length ? seriesValues : options.fields;
  const label = (field) => field.replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
  const tick = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(value)
    ? shortDate(value) : value;
  const percent = (value) => percentage(value).replace("+", "");
  const xLabel = {
    value: options.x === component.chart.x ? component.chart.xLabel ?? label(options.x) : label(options.x),
    position: "insideBottom", offset: -12,
  };
  const yLabel = {
    value: options.y === component.chart.y ? component.chart.yLabel ?? label(options.y) : label(options.y),
    angle: -90, position: "insideLeft", offset: -8,
  };
  const margin = { top: 10, right: 18, bottom: 26, left: 20 };
  let chart;

  if (options.type === "pie") {
    chart = <PieChart><Tooltip /><Pie data={rows} dataKey={options.y} nameKey={options.x} label>
      {rows.map((row, index) => <Cell key={String(row[options.x])} fill={colors[index % colors.length]} />)}
    </Pie></PieChart>;
  } else if (options.type === "histogram") {
    const values = rows.map((row) => Number(row[options.y])).filter(Number.isFinite);
    const width = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(...values, 1))) - 1);
    const counts = new Map();
    values.forEach((value) => {
      const start = Math.floor(value / width) * width;
      counts.set(start, (counts.get(start) ?? 0) + 1);
    });
    const buckets = [...counts].map(([start, count]) => ({
      start, range: `${compact(start)}–${compact(start + width)}`, count,
    })).sort((left, right) => left.start - right.start);
    chart = <BarChart data={buckets} margin={margin}><CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="range" label={{ ...xLabel, value: label(options.y) }} />
      <YAxis allowDecimals={false} label={{ ...yLabel, value: "Count" }} width={72} /><Tooltip />
      <Bar dataKey="count" fill={colors[0]} radius={[5, 5, 0, 0]} />
    </BarChart>;
  } else if (options.type === "heatmap") {
    const group = options.series || columns.find((column) => column !== options.x
      && !numeric.includes(column)) || options.x;
    const xLabels = [...new Set(rows.map((row) => row[options.x]))];
    const yLabels = [...new Set(rows.map((row) => row[group]))];
    const xIndexes = new Map(xLabels.map((value, index) => [value, index]));
    const yIndexes = new Map(yLabels.map((value, index) => [value, index]));
    const maximum = rows.reduce((largest, row) => Math.max(largest, Number(row[options.y]) || 0), 1);
    const cells = rows.map((row) => ({
      ...row, xIndex: xIndexes.get(row[options.x]), yIndex: yIndexes.get(row[group]),
      intensity: (Number(row[options.y]) || 0) / maximum,
    }));
    chart = <ScatterChart margin={margin}>
      <XAxis type="number" dataKey="xIndex" domain={[-0.5, Math.max(0.5, xLabels.length - 0.5)]}
        ticks={xLabels.map((_, index) => index)} tickFormatter={(index) => tick(xLabels[index])} label={xLabel} />
      <YAxis type="number" dataKey="yIndex" domain={[-0.5, Math.max(0.5, yLabels.length - 0.5)]}
        ticks={yLabels.map((_, index) => index)} tickFormatter={(index) => yLabels[index]} width={80}
        label={{ ...yLabel, value: label(group) }} />
      <ZAxis dataKey={options.y} /><Tooltip /><Scatter data={cells} shape={<HeatCell />} />
    </ScatterChart>;
  } else if (options.type === "scatter") {
    chart = <ScatterChart margin={margin}><CartesianGrid stroke="var(--border)" />
      <XAxis type={numeric.includes(options.x) ? "number" : "category"} dataKey={options.x}
        tickFormatter={numeric.includes(options.x) ? compact : tick} label={xLabel} />
      <YAxis type="number" dataKey={options.y} tickFormatter={compact} label={yLabel} width={72} />
      <Tooltip />{seriesValues.length > 1 && <Legend />}{seriesValues.length ? seriesValues.map((value, index) =>
        <Scatter key={value} name={String(value)} data={rows.filter((row) => row[options.series] === value)}
          fill={colors[index % colors.length]} />) : <Scatter data={rows} fill={colors[0]} />}
    </ScatterChart>;
  } else if (options.type === "waterfall") {
    let balance = 0;
    const bridge = rows.map((row) => {
      const change = Number(row[options.y]) || 0;
      const previous = balance;
      balance += change;
      return { ...row, baseline: Math.min(previous, balance), magnitude: Math.abs(change), change };
    });
    chart = <BarChart data={bridge} margin={margin}><CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey={options.x} tickFormatter={tick} label={xLabel} />
      <YAxis tickFormatter={compact} label={yLabel} width={72} /><Tooltip />
      <Bar dataKey="baseline" stackId="bridge" fill="transparent" />
      <Bar dataKey="magnitude" stackId="bridge">{bridge.map((row, index) =>
        <Cell key={index} fill={row.change < 0 ? "var(--negative)" : colors[0]} />)}</Bar>
    </BarChart>;
  } else if (options.type === "boxPlot") {
    const reviewedQuartiles = rows.every((row) => ["minimum", "lowerQuartile", "median", "upperQuartile", "maximum"]
      .every((field) => typeof row[field] === "number"));
    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row[options.x])) grouped.set(row[options.x], []);
      grouped.get(row[options.x]).push(Number(row[options.y]));
    });
    const distributions = reviewedQuartiles ? rows : [...grouped].map(([label, observations]) => {
      const ordered = observations.filter(Number.isFinite).sort((left, right) => left - right);
      return {
        [options.x]: label, minimum: ordered[0], lowerQuartile: quantile(ordered, 0.25),
        median: quantile(ordered, 0.5), upperQuartile: quantile(ordered, 0.75), maximum: ordered.at(-1),
      };
    });
    const boxes = distributions.map((row) => ({ ...row, spread: row.upperQuartile - row.lowerQuartile }));
    chart = <ComposedChart data={boxes} margin={margin}>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey={options.x} tickFormatter={tick} label={xLabel} />
      <YAxis domain={[0, Math.max(...boxes.map((row) => row.maximum), 1) * 1.1]} label={yLabel} width={72} />
      <Tooltip />
      <Bar dataKey="lowerQuartile" stackId="box" fill="transparent" />
      <Bar dataKey="spread" stackId="box" shape={<BoxShape />} />
    </ComposedChart>;
  } else if (options.type === "funnel") {
    chart = <FunnelChart><Tooltip /><Funnel data={rows} dataKey={options.y} nameKey={options.x}>
      {rows.map((row, index) => <Cell key={String(row[options.x])} fill={colors[index % colors.length]} />)}
      <LabelList position="right" dataKey={options.x} /></Funnel></FunnelChart>;
  } else if (options.type === "line" || options.type === "sparkline") {
    chart = <LineChart data={data} margin={margin}><CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey={options.x} tickFormatter={tick} label={xLabel} />
      <YAxis tickFormatter={compact} label={yLabel} width={72} /><Tooltip labelFormatter={tick} /><Legend />
      {fields.map((field, index) => <Line key={field} type="monotone" dataKey={field}
        stroke={colors[index % colors.length]} strokeWidth={2} />)}
    </LineChart>;
  } else if (options.type === "area" || options.type === "stackedArea") {
    chart = <AreaChart data={data} margin={margin}><CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey={options.x} tickFormatter={tick} label={xLabel} />
      <YAxis tickFormatter={compact} label={yLabel} width={72} /><Tooltip labelFormatter={tick} /><Legend />
      {fields.map((field, index) => <Area key={field} dataKey={field} type="monotone"
        stackId={stacked ? "stack" : undefined} stroke={colors[index % colors.length]}
        fill={colors[index % colors.length]} fillOpacity={0.18} />)}
    </AreaChart>;
  } else {
    chart = <BarChart data={data} margin={margin} layout={horizontal ? "vertical" : "horizontal"}
      stackOffset={proportional ? "expand" : "none"}>
      <CartesianGrid stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
      <XAxis type={horizontal ? "number" : "category"} dataKey={horizontal ? undefined : options.x}
        tickFormatter={horizontal ? proportional ? percent : compact : tick}
        label={horizontal ? { ...xLabel, value: label(options.y) } : xLabel} />
      <YAxis type={horizontal ? "category" : "number"} dataKey={horizontal ? options.x : undefined}
        tickFormatter={horizontal ? tick : proportional ? percent : compact} width={horizontal ? 90 : 72}
        label={horizontal ? { ...yLabel, value: label(options.x) } : yLabel} />
      <Tooltip /><Legend />{fields.map((field, index) => <Bar key={field} dataKey={field}
        stackId={stacked ? "stack" : undefined} fill={colors[index % colors.length]} radius={stacked ? 0 : 4} />)}
    </BarChart>;
  }

  return (
    <>
      <div className="toolbar">
        <Dropdown label="Chart type" value={options.type} choices={chartTypes} onChange={update("type")} />
        <Dropdown label="X axis" value={options.x} choices={columns} onChange={update("x")} />
        <Dropdown label="Y axis" value={options.y} choices={numeric} onChange={update("y")} />
        <Dropdown label="Series by" value={options.series}
          choices={["", ...columns.filter((column) => column !== options.x && !numeric.includes(column))]}
          onChange={update("series")} />
        <button className="copy-button" onClick={() => setOptions(initial)}>Reset</button>
      </div>
      <ResponsiveContainer width="100%" height={410}>{chart}</ResponsiveContainer>
      <DataTable rows={rows} />
    </>
  );
}
