import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, ChartCard, Dialog } from "./components/Card.jsx";
import { ChartExplorer, colors } from "./components/ChartExplorer.jsx";
import { DataTable, Dropdown, Filters } from "./components/Controls.jsx";
import { SourceInspector } from "./components/SourceInspector.jsx";
import snapshot from "./data.json";
import { useDashboard } from "./use-dashboard.js";
import "./styles.css";

const CONTROL = "Control";
const GUIDED = "Guided onboarding";
const CONTROL_COLOR = "#64748b";
const GUIDED_COLOR = "#00a889";
const CORAL = "#f06d4f";
const COUNT_FIELDS = [
  "members",
  "activated",
  "retained60",
  "engagedRetained60",
  "paired24",
  "calibrated7",
  "consistentWear7",
  "insightThreshold7",
  "cancelled14",
];

const segmentOptions = {
  acquisitionChannel: "Acquisition channel",
  planTier: "Plan tier",
  platform: "Platform",
};

function emptyTotals() {
  return {
    members: 0,
    activated: 0,
    retained60: 0,
    engagedRetained60: 0,
    paired24: 0,
    calibrated7: 0,
    consistentWear7: 0,
    insightThreshold7: 0,
    cancelled14: 0,
  };
}

function addRow(total, row) {
  COUNT_FIELDS.forEach((field) => {
    total[field] += Number(row[field] ?? 0);
  });
  return total;
}

function totalsByVariant(rows) {
  const totals = { [CONTROL]: emptyTotals(), [GUIDED]: emptyTotals() };
  rows.forEach((row) => {
    if (totals[row.variant]) addRow(totals[row.variant], row);
  });
  return totals;
}

function safeRate(successes, members) {
  return members ? successes / members : 0;
}

function differenceInterval(treatmentSuccesses, treatmentN, controlSuccesses, controlN) {
  const treatmentRate = safeRate(treatmentSuccesses, treatmentN);
  const controlRate = safeRate(controlSuccesses, controlN);
  const lift = treatmentRate - controlRate;
  const standardError = Math.sqrt(
    treatmentRate * (1 - treatmentRate) / Math.max(1, treatmentN)
    + controlRate * (1 - controlRate) / Math.max(1, controlN),
  );
  return {
    treatmentRate,
    controlRate,
    lift,
    low: lift - 1.96 * standardError,
    high: lift + 1.96 * standardError,
  };
}

function percent(value) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function points(value) {
  const formatted = Math.abs(value * 100).toFixed(1);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted} pp`;
}

function perThousand(value) {
  return Math.round(Math.abs(value) * 1000);
}

function peopleChange(value, noun = "members") {
  const count = perThousand(value);
  if (!count) return `No difference per 1,000 ${noun}`;
  return `${count} ${value > 0 ? "more" : "fewer"}`;
}

function peopleRange(low, high, noun = "members") {
  const lowCount = perThousand(low);
  const highCount = perThousand(high);
  if (low < 0 && high > 0) {
    return `${lowCount} fewer to ${highCount} more ${noun} per 1,000`;
  }
  if (low >= 0) return `${lowCount}–${highCount} more ${noun} per 1,000`;
  return `${highCount}–${lowCount} fewer ${noun} per 1,000`;
}

function compact(value) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function buildWeekly(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = `${row.signupWeek}|${row.variant}`;
    if (!grouped.has(key)) grouped.set(key, {
      signupWeek: row.signupWeek,
      variant: row.variant,
      members: 0,
      activated: 0,
    });
    const total = grouped.get(key);
    total.members += Number(row.members);
    total.activated += Number(row.activated);
  });
  const tidy = [...grouped.values()]
    .map((row) => ({ ...row, activationRate: safeRate(row.activated, row.members) }))
    .sort((left, right) => left.signupWeek.localeCompare(right.signupWeek)
      || left.variant.localeCompare(right.variant));
  const wide = new Map();
  tidy.forEach((row) => {
    if (!wide.has(row.signupWeek)) wide.set(row.signupWeek, { signupWeek: row.signupWeek });
    wide.get(row.signupWeek)[row.variant] = row.activationRate;
  });
  return [...wide.values()].sort((left, right) => left.signupWeek.localeCompare(right.signupWeek));
}

function buildSegments(rows, field) {
  const grouped = new Map();
  rows.forEach((row) => {
    const segment = row[field];
    const key = `${segment}|${row.variant}`;
    if (!grouped.has(key)) grouped.set(key, {
      ...emptyTotals(),
      segment,
      variant: row.variant,
    });
    addRow(grouped.get(key), row);
  });

  const segments = [...new Set([...grouped.values()].map((row) => row.segment))];
  return segments.map((segment) => {
    const control = grouped.get(`${segment}|${CONTROL}`) ?? emptyTotals();
    const guided = grouped.get(`${segment}|${GUIDED}`) ?? emptyTotals();
    const activation = differenceInterval(
      guided.activated, guided.members, control.activated, control.members,
    );
    const retention = differenceInterval(
      guided.retained60, guided.members, control.retained60, control.members,
    );
    return {
      segment,
      controlN: control.members,
      guidedN: guided.members,
      controlActivation: activation.controlRate,
      guidedActivation: activation.treatmentRate,
      activationLift: activation.lift,
      retentionLift: retention.lift,
    };
  }).sort((left, right) => right.activationLift - left.activationLift);
}

function MetricCard({
  id, title, metric, description, common, tone = "positive", noun = "members",
}) {
  return (
    <Card id={id} title={title} kind="metric" queryId="cohort_trend"
      description={description} {...common}>
      <p className={`metric-value ${tone}`}>{peopleChange(metric.lift, noun)}</p>
      <span className="metric-unit">per 1,000 new members</span>
      <span className="metric-context">
        {perThousand(metric.controlRate)} comparison → {perThousand(metric.treatmentRate)} guided
      </span>
      <span className="metric-ci">Likely range: {peopleRange(metric.low, metric.high, noun)}</span>
      <details className="technical-note">
        <summary>Technical detail</summary>
        <p>{points(metric.lift)}; 95% CI {points(metric.low)} to {points(metric.high)}</p>
      </details>
    </Card>
  );
}

export function App() {
  const { queries, filters, setFilter, reviewedRows, activeFilters } = useDashboard(snapshot);
  const [dialog, setDialog] = useState(null);
  const [segmentField, setSegmentField] = useState("acquisitionChannel");

  const sourceRows = reviewedRows("cohort_trend", [
    "signupWeek", "variant", "acquisitionChannel", "planTier", "platform",
  ]);
  const overallTotals = useMemo(
    () => totalsByVariant(queries.cohort_trend?.rows ?? []),
    [queries],
  );
  const overallControl = overallTotals[CONTROL];
  const overallGuided = overallTotals[GUIDED];
  const overallActivation = differenceInterval(
    overallGuided.activated, overallGuided.members,
    overallControl.activated, overallControl.members,
  );
  const overallRetention = differenceInterval(
    overallGuided.retained60, overallGuided.members,
    overallControl.retained60, overallControl.members,
  );
  const totals = useMemo(() => totalsByVariant(sourceRows), [sourceRows]);
  const control = totals[CONTROL];
  const guided = totals[GUIDED];
  const totalMembers = control.members + guided.members;

  const activation = differenceInterval(
    guided.activated, guided.members, control.activated, control.members,
  );
  const retention = differenceInterval(
    guided.retained60, guided.members, control.retained60, control.members,
  );
  const engagedRetention = differenceInterval(
    guided.engagedRetained60, guided.members,
    control.engagedRetained60, control.members,
  );
  const pairing = differenceInterval(
    guided.paired24, guided.members, control.paired24, control.members,
  );
  const cancellation = differenceInterval(
    guided.cancelled14, guided.members, control.cancelled14, control.members,
  );

  const outcomeRows = [
    {
      metric: "Activated by day 7",
      Control: activation.controlRate,
      "Guided onboarding": activation.treatmentRate,
    },
    {
      metric: "Paid membership on day 60",
      Control: retention.controlRate,
      "Guided onboarding": retention.treatmentRate,
    },
    {
      metric: "Active use on day 60",
      Control: engagedRetention.controlRate,
      "Guided onboarding": engagedRetention.treatmentRate,
    },
  ];

  const weeklyRows = useMemo(() => buildWeekly(sourceRows), [sourceRows]);
  const componentRows = [
    {
      stage: "Paired in 24h",
      Control: safeRate(control.paired24, control.members),
      "Guided onboarding": safeRate(guided.paired24, guided.members),
    },
    {
      stage: "Calibrated by day 7",
      Control: safeRate(control.calibrated7, control.members),
      "Guided onboarding": safeRate(guided.calibrated7, guided.members),
    },
    {
      stage: "5+ valid wear days",
      Control: safeRate(control.consistentWear7, control.members),
      "Guided onboarding": safeRate(guided.consistentWear7, guided.members),
    },
    {
      stage: "3+ insight views",
      Control: safeRate(control.insightThreshold7, control.members),
      "Guided onboarding": safeRate(guided.insightThreshold7, guided.members),
    },
    {
      stage: "Activated",
      Control: activation.controlRate,
      "Guided onboarding": activation.treatmentRate,
    },
  ];
  const segmentRows = useMemo(
    () => buildSegments(sourceRows, segmentField),
    [sourceRows, segmentField],
  );
  const segmentChartRows = segmentRows.map((row) => ({
    ...row,
    additionalActivatedPerThousand: Math.round(row.activationLift * 1000),
  }));
  const segmentTableRows = segmentRows.map((row) => ({
    "Signup source": row.segment,
    "Comparison members": row.controlN,
    "Guided members": row.guidedN,
    "Comparison activation": percent(row.controlActivation),
    "Guided activation": percent(row.guidedActivation),
    "Activation difference": `${(row.activationLift * 100).toFixed(1)} percentage points`,
    "Day-60 retention difference": `${row.retentionLift >= 0 ? "+" : "−"}${Math.abs(row.retentionLift * 100).toFixed(1)} percentage points`,
  }));

  const guardrailRows = [
    {
      metric: "24-hour pairing",
      liftValue: pairing.lift,
      control: percent(pairing.controlRate),
      guided: percent(pairing.treatmentRate),
      lift: points(pairing.lift),
      interval: `${points(pairing.low)} to ${points(pairing.high)}`,
      status: pairing.low < 0 && pairing.high > 0 ? "No detected change" : "Review",
    },
    {
      metric: "14-day cancellation",
      liftValue: cancellation.lift,
      control: percent(cancellation.controlRate),
      guided: percent(cancellation.treatmentRate),
      lift: points(cancellation.lift),
      interval: `${points(cancellation.low)} to ${points(cancellation.high)}`,
      status: cancellation.low < 0 && cancellation.high > 0 ? "No detected harm" : "Review",
    },
  ];

  const derivedRows = {
    "outcome-comparison": outcomeRows,
    "weekly-activation": weeklyRows,
    "activation-components": componentRows,
    "segment-lift": segmentChartRows,
  };

  const open = (type, component) => setDialog({ type, component });
  const common = { onOpen: open };
  const renderCard = (_id, element) => element;
  const decisionStatus = overallRetention.low > -0.01
    ? "Evidence supports a broad rollout"
    : "Expand gradually · keep a comparison group";

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Synthetic wearable membership case study</p>
          <h1>Guided onboarding helps members get started</h1>
          <p className="hero-copy">
            Its effect on paid membership after 60 days is still uncertain.
          </p>
        </div>
        <div className="hero-meta">
          <span className="decision-badge">{decisionStatus}</span>
          <span className="fixture-badge">Synthetic data</span>
          <span className="freshness">Snapshot · Jul 30, 2026</span>
        </div>
      </header>

      <section className="decision-strip" aria-label="Decision recommendation">
        <div className="decision-icon">↗</div>
        <div>
          <p className="decision-label">What should the team do overall?</p>
          <p className="decision-copy">
            <strong>Expand guided onboarding in stages—but do not make it the only experience yet.</strong>{" "}
            It produced about {perThousand(overallActivation.lift)} additional activated members
            per 1,000 signups. We still cannot rule out a small decline in paid membership on
            day 60, so keep a randomly selected comparison group.
          </p>
          <details className="decision-technical">
            <summary>Technical decision rule</summary>
            <p>Continue the experiment until the lower bound of the 95% confidence interval for
              day-60 subscription retention is above the −1 percentage-point non-inferiority margin.</p>
          </details>
        </div>
      </section>

      <section className="plain-guide" aria-label="How to read this dashboard">
        <article>
          <span>1</span>
          <div><h2>What was tested</h2><p>New members were randomly assigned to the current or guided onboarding experience.</p></div>
        </article>
        <article>
          <span>2</span>
          <div><h2>What “activated” means</h2><p>Calibrated by day 7, wore the device on at least 5 days, and viewed at least 3 insights.</p></div>
        </article>
        <article>
          <span>3</span>
          <div><h2>How results are shown</h2><p>Plain-language counts use 1,000 members. Open “Technical detail” for percentage points and confidence intervals.</p></div>
        </article>
      </section>

      <div className="filter-intro">
        <div><p className="section-kicker">Explore a group</p><p>Every result below updates when you choose a signup source, plan, or phone platform.</p></div>
      </div>
      <Filters filters={snapshot.filters ?? []} queries={queries}
        values={filters} onChange={setFilter} />

      <section className="section-heading">
        <div><p className="section-kicker">What happened?</p><h2>More members succeeded early; the day-60 result remains uncertain</h2></div>
        <p>{activeFilters.length ? `${activeFilters.length} filter${activeFilters.length > 1 ? "s" : ""} active` : `All ${totalMembers.toLocaleString()} members`}</p>
      </section>

      <section className="metric-grid">
        {renderCard("activation-lift", <MetricCard id="activation-lift" title="Additional members activated by day 7"
          metric={activation} description="Primary outcome: members who calibrated, wore the device on at least 5 of their first 7 days, and viewed at least 3 insights."
          common={common} />)}
        {renderCard("retention-lift", <MetricCard id="retention-lift" title="Additional paid members on day 60"
          metric={retention} description="Secondary outcome: members whose subscription was still active on day 60."
          common={common} tone={retention.low > 0 ? "positive" : "caution"} noun="paid members" />)}
        {renderCard("engaged-retention-lift", <MetricCard id="engaged-retention-lift" title="Additional active users around day 60"
          metric={engagedRetention} description="Members with an active subscription and at least three valid wear days from days 54 through 60."
          noun="active users"
          common={common} />)}
        {renderCard("population", <Card id="population" title="Members included in the comparison" kind="metric"
          queryId="cohort_trend" description="Every randomly assigned member is included, even if they did not finish onboarding." {...common}>
          <p className="metric-value neutral">{totalMembers.toLocaleString()}</p>
          <span className="metric-unit">members</span>
          <span className="metric-context">{control.members.toLocaleString()} comparison · {guided.members.toLocaleString()} guided</span>
          <span className="metric-ci">Everyone has a complete 60-day observation window</span>
          <details className="technical-note"><summary>Technical detail</summary><p>Intention-to-treat population after dashboard filters.</p></details>
        </Card>)}
      </section>

      <section className="section-heading">
        <div><p className="section-kicker">See the evidence</p><h2>Compare outcomes, consistency over time, and early behaviors</h2></div>
      </section>

      <section className="charts">
        {renderCard("outcome-comparison", <ChartCard id="outcome-comparison"
          title="How many members reached each outcome?" queryId="cohort_trend" wide height={310}
          description="Percentages include every randomly assigned member. Use the source menu for exact definitions and SQL."
          chart={{ type: "bar", x: "metric", y: "Control", fields: ["Control", "Guided onboarding"] }}
          {...common}>
          <BarChart data={outcomeRows} margin={{ top: 12, right: 12, bottom: 18, left: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={percent} domain={[0, 0.75]} width={58} />
            <Tooltip formatter={(value) => percent(value)} />
            <Legend />
            <Bar dataKey="Control" fill={CONTROL_COLOR} radius={[5, 5, 0, 0]} />
            <Bar dataKey="Guided onboarding" fill={GUIDED_COLOR} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ChartCard>)}

        {renderCard("weekly-activation", <ChartCard id="weekly-activation"
          title="Was the activation improvement consistent over time?" queryId="cohort_trend" wide height={300}
          description="Weekly signup groups help show whether the result was stable rather than driven by one unusual week."
          chart={{ type: "line", x: "signupWeek", y: "Control", fields: ["Control", "Guided onboarding"] }}
          {...common}>
          <LineChart data={weeklyRows} margin={{ top: 12, right: 12, bottom: 14, left: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="signupWeek" tickFormatter={(value) => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} />
            <YAxis tickFormatter={percent} domain={[0.15, 0.60]} width={58} />
            <Tooltip formatter={(value) => percent(value)} />
            <Legend />
            <Line dataKey="Control" stroke={CONTROL_COLOR} strokeWidth={2.5} dot={false} />
            <Line dataKey="Guided onboarding" stroke={GUIDED_COLOR} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ChartCard>)}

        {renderCard("activation-components", <ChartCard id="activation-components"
          title="Which early member behaviors changed?" queryId="cohort_trend" height={330}
          description="These are separate activation requirements, not steps in a sequential funnel."
          chart={{ type: "horizontalBar", x: "stage", y: "Control", fields: ["Control", "Guided onboarding"] }}
          {...common}>
          <BarChart data={componentRows} layout="vertical" margin={{ top: 6, right: 14, bottom: 8, left: 26 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tickFormatter={percent} domain={[0, 1]} />
            <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => percent(value)} />
            <Legend />
            <Bar dataKey="Control" fill={CONTROL_COLOR} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Guided onboarding" fill={GUIDED_COLOR} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>)}

        {renderCard("segment-lift", <ChartCard id="segment-lift"
          title="Additional activated members per 1,000 signups" queryId="cohort_trend" height={330}
          description="Exploratory comparison by member characteristics known before onboarding. These differences are hypotheses, not proven subgroup effects."
          chart={{ type: "horizontalBar", x: "segment", y: "additionalActivatedPerThousand" }}
          {...common}>
          <BarChart data={segmentChartRows} layout="vertical" margin={{ top: 6, right: 14, bottom: 8, left: 20 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tickFormatter={(value) => `${value > 0 ? "+" : ""}${value}`} domain={["dataMin - 20", "dataMax + 20"]} />
            <YAxis type="category" dataKey="segment" width={92} />
            <Tooltip formatter={(value) => [`${value} more per 1,000`, "Activation difference"]} />
            <ReferenceLine x={0} stroke="var(--secondary)" />
            <Bar dataKey="additionalActivatedPerThousand" name="Additional activated members" radius={[0, 5, 5, 0]}>
              {segmentChartRows.map((row) => <Cell key={row.segment}
                fill={row.activationLift >= 0 ? GUIDED_COLOR : CORAL} />)}
            </Bar>
          </BarChart>
        </ChartCard>)}
      </section>

      <section className="table-section">
        <div className="table-header">
          <div><p className="section-kicker">Questions for the next analysis</p><h2>Where does the result look different?</h2></div>
          <Dropdown label="Group members by" value={segmentField}
            choices={Object.keys(segmentOptions)} onChange={setSegmentField}
            formatChoice={(choice) => segmentOptions[choice] ?? choice} />
        </div>
        <p className="section-note">
          Grouped by {segmentOptions[segmentField].toLowerCase()}. Use these results to choose
          follow-up questions—not to claim that onboarding works best for one group.
        </p>
        <DataTable rows={segmentTableRows} searchable={false} />
      </section>

      <section className="guardrail-grid">
        <div className="guardrail-copy">
          <p className="section-kicker">What did not improve?</p>
          <h2>Device pairing stayed about the same, and early cancellation did not increase</h2>
          <p>Guidance appears to help after hardware setup. The team should treat device pairing as a separate product problem.</p>
        </div>
        {guardrailRows.map((row) => (
          <article className="guardrail-card" key={row.metric}>
            <span className="guardrail-status">{row.status}</span>
            <h3>{row.metric}</h3>
            <p className="guardrail-value">{peopleChange(row.liftValue)}</p>
            <p>per 1,000 members</p>
            <p>{row.control} comparison → {row.guided} guided</p>
            <details className="technical-note"><summary>Technical detail</summary><p>{row.lift}; 95% CI {row.interval}</p></details>
          </article>
        ))}
      </section>

      <details className="glossary">
        <summary>Plain-language glossary and measurement definitions</summary>
        <dl>
          <div><dt>Activated by day 7</dt><dd>Completed calibration, wore the device on at least 5 days, and viewed at least 3 insights during the first 7 days.</dd></div>
          <div><dt>Paid member on day 60</dt><dd>The member’s subscription was still active 60 days after assignment.</dd></div>
          <div><dt>Comparison group</dt><dd>Members who received the existing onboarding experience so the team can estimate what would have happened without the new guidance.</dd></div>
          <div><dt>Likely range</dt><dd>The plain-language version of a 95% confidence interval. It shows the uncertainty around an estimated difference.</dd></div>
          <div><dt>Percentage point</dt><dd>The direct difference between two percentages—for example, 40% minus 31% equals 9 percentage points.</dd></div>
        </dl>
      </details>

      <footer>
        <p><strong>PulsePath is fictional.</strong> No real member, WHOOP, biometric, or financial data is used.</p>
        <p><strong>For technical readers:</strong> use each three-dot menu to inspect reviewed rows, exact metric definitions, confidence intervals, and source SQL.</p>
      </footer>

      {dialog && (
        <Dialog title={dialog.component.title} expanded={dialog.type === "explore"}
          onClose={() => setDialog(null)}>
          {dialog.type === "explore" ? (
            <ChartExplorer component={dialog.component}
              rows={derivedRows[dialog.component.id] ?? sourceRows} />
          ) : (
            <SourceInspector component={dialog.component}
              query={queries[dialog.component.queryId]}
              rows={reviewedRows(dialog.component.queryId)}
              filters={activeFilters} generatedAt={snapshot.generatedAt} />
          )}
        </Dialog>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>,
);
