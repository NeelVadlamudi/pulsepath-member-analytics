"""Create and execute the reader-facing analysis notebook with nbformat."""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf
from nbclient import NotebookClient


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "notebooks" / "member_activation_retention.ipynb"


def code(source: str):
    return nbf.v4.new_code_cell(source.strip())


def markdown(source: str):
    return nbf.v4.new_markdown_cell(source.strip())


def main() -> None:
    notebook = nbf.v4.new_notebook()
    notebook["metadata"]["kernelspec"] = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    }
    notebook["metadata"]["language_info"] = {"name": "python", "version": "3.9"}
    notebook["cells"] = [
        markdown(
            """
# Guided Onboarding: Member Activation and Retention

## tl;dr

- Guided onboarding increased 7-day activation from **31.9% to 40.8%**:
  **+8.9 percentage points**, 95% CI **[+6.5, +11.3]**.
- D60 subscription retention increased from **61.9% to 62.8%**, but the
  **+0.9-point** estimate is inconclusive: 95% CI **[-1.5, +3.4]**.
- D60 engaged retention increased **+3.4 points**, while 24-hour pairing and
  14-day cancellation showed no detected material harm.
- **Recommendation:** stage the rollout and retain a control holdout. The
  activation evidence is strong; the long-term subscription outcome still
  needs monitoring.

> PulsePath and every record in this notebook are synthetic. This is a
> portfolio case study, not an analysis of WHOOP or any real member.
"""
        ),
        markdown(
            """
## Context & Methods

The product decision is whether to roll out guided onboarding to new wearable
members. The primary KPI is 7-day activation; D60 subscription retention is the
longer-term outcome. The analysis uses intention-to-treat, so every assigned
member remains in the denominator.

### Key Assumptions

- A valid wear day has at least 18 hours of simulated wear.
- Activation requires five valid wear days, completed calibration, and three
  insight views during relative days 0–6.
- D60 engaged retention requires an active subscription on day 60 and at least
  three valid wear days during days 54–60.
- Segment results are exploratory because the experiment was designed for the
  overall effect.
"""
        ),
        code(
            """
from pathlib import Path
import duckdb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import norm

ROOT = Path.cwd()
DATABASE_PATH = ROOT / "data" / "processed" / "pulsepath.duckdb"
connection = duckdb.connect(str(DATABASE_PATH), read_only=True)
plt.style.use("seaborn-v0_8-whitegrid")
"""
        ),
        markdown("## Data\n\n### 1. Load reviewed member outcomes"),
        code(
            """
outcomes = connection.sql(\"\"\"
    select *
    from member_outcomes
    order by member_id
\"\"\").df()

print(f"Members: {len(outcomes):,}")
print(f"Unique member IDs: {outcomes['member_id'].nunique():,}")
print(f"Signup range: {outcomes['signup_date'].min()} to {outcomes['signup_date'].max()}")
outcomes.head()
"""
        ),
        markdown("### 2. Check assignment, completeness, and analytical grain"),
        code(
            """
quality_summary = pd.DataFrame({
    "check": [
        "Duplicate member IDs",
        "Missing experiment variant",
        "Missing activation outcome",
        "Missing D60 retention outcome",
        "Wear days outside 0–7",
    ],
    "failures": [
        outcomes.duplicated("member_id").sum(),
        outcomes["experiment_variant"].isna().sum(),
        outcomes["activated_7d"].isna().sum(),
        outcomes["retained_60d"].isna().sum(),
        (~outcomes["valid_wear_days_7d"].between(0, 7)).sum(),
    ],
})

assignment = outcomes["experiment_variant"].value_counts().rename_axis("variant").reset_index(name="members")
display(quality_summary)
display(assignment)
"""
        ),
        markdown(
            """
## Results

### 3. Recalculate experiment lift and uncertainty

The comparison below is independent of the dashboard export and uses the
member-level outcome table.
"""
        ),
        code(
            """
def difference_in_proportions(frame, outcome):
    treatment = frame.loc[
        frame["experiment_variant"].eq("Guided onboarding"), outcome
    ].astype(int)
    control = frame.loc[frame["experiment_variant"].eq("Control"), outcome].astype(int)
    treatment_rate = treatment.mean()
    control_rate = control.mean()
    lift = treatment_rate - control_rate
    standard_error = np.sqrt(
        treatment_rate * (1 - treatment_rate) / len(treatment)
        + control_rate * (1 - control_rate) / len(control)
    )
    z_value = norm.ppf(0.975)
    z_score = lift / standard_error
    return {
        "control_rate": control_rate,
        "guided_rate": treatment_rate,
        "absolute_lift": lift,
        "ci_low": lift - z_value * standard_error,
        "ci_high": lift + z_value * standard_error,
        "p_value": 2 * (1 - norm.cdf(abs(z_score))),
    }

metric_map = {
    "7-day activation": "activated_7d",
    "D60 subscription retention": "retained_60d",
    "D60 engaged retention": "engaged_retained_60d",
    "24-hour device pairing": "device_paired_24h",
    "14-day cancellation": "cancelled_14d",
}
results = pd.DataFrame([
    {"metric": label, **difference_in_proportions(outcomes, column)}
    for label, column in metric_map.items()
])
results.style.format({
    "control_rate": "{:.1%}",
    "guided_rate": "{:.1%}",
    "absolute_lift": "{:+.1%}",
    "ci_low": "{:+.1%}",
    "ci_high": "{:+.1%}",
    "p_value": "{:.4f}",
})
"""
        ),
        markdown("### 4. Compare the primary outcome and long-term guardrails"),
        code(
            """
plot_metrics = results.iloc[:5].copy()
plot_metrics["control_pct"] = plot_metrics["control_rate"] * 100
plot_metrics["guided_pct"] = plot_metrics["guided_rate"] * 100

positions = np.arange(len(plot_metrics))
width = 0.36
fig, ax = plt.subplots(figsize=(10, 5.2))
ax.bar(positions - width / 2, plot_metrics["control_pct"], width, label="Control", color="#7a8795")
ax.bar(positions + width / 2, plot_metrics["guided_pct"], width, label="Guided onboarding", color="#00a889")
ax.set_ylabel("Assigned members (%)")
ax.set_xticks(positions)
ax.set_xticklabels(plot_metrics["metric"], rotation=18, ha="right")
ax.set_title("Experiment outcomes by assigned variant")
ax.legend(frameon=False)
ax.set_ylim(0, max(plot_metrics["guided_pct"].max(), plot_metrics["control_pct"].max()) + 12)
plt.tight_layout()
plt.show()
"""
        ),
        markdown(
            """
The activation movement is large and precisely estimated. D60 subscription
retention is directionally positive, but its interval crosses zero and the
pre-agreed one-point non-inferiority boundary. Engaged retention provides a
useful secondary signal, not a substitute for the subscription outcome.
"""
        ),
        markdown("### 5. Inspect which activation components moved"),
        code(
            """
drivers = connection.sql(\"\"\"
    select
        experiment_variant,
        avg(device_paired_24h::integer) as paired_24h,
        avg(calibration_completed_7d::integer) as calibrated_7d,
        avg((valid_wear_days_7d >= 5)::integer) as consistent_wear_7d,
        avg((insight_views_7d >= 3)::integer) as insight_threshold_7d,
        avg(activated_7d::integer) as activated_7d
    from member_outcomes
    group by 1
    order by 1
\"\"\").df()
drivers.style.format({
    "paired_24h": "{:.1%}",
    "calibrated_7d": "{:.1%}",
    "consistent_wear_7d": "{:.1%}",
    "insight_threshold_7d": "{:.1%}",
    "activated_7d": "{:.1%}",
})
"""
        ),
        markdown(
            """
Pairing did not improve, so the experiment's value appears after initial
hardware setup. That suggests the next iteration should preserve guided
calibration and insight education while separately addressing pairing friction.
"""
        ),
        markdown("### 6. Review pre-treatment segments without overclaiming"),
        code(
            """
segments = connection.sql(\"\"\"
    select
        segment_type,
        segment_value,
        max(activation_rate) filter (
            where experiment_variant = 'Guided onboarding'
        ) - max(activation_rate) filter (
            where experiment_variant = 'Control'
        ) as activation_lift,
        max(retained_60d_rate) filter (
            where experiment_variant = 'Guided onboarding'
        ) - max(retained_60d_rate) filter (
            where experiment_variant = 'Control'
        ) as retention_lift,
        min(assigned_members) as minimum_variant_n
    from experiment_results
    where segment_type <> 'Overall'
    group by 1, 2
    order by 1, activation_lift desc
\"\"\").df()
segments.style.format({
    "activation_lift": "{:+.1%}",
    "retention_lift": "{:+.1%}",
    "minimum_variant_n": "{:,.0f}",
})
"""
        ),
        markdown(
            """
Segment variation is useful for hypothesis generation, but none of these cuts
should determine targeting without multiplicity control and adequate power.
"""
        ),
        markdown(
            """
## Takeaways

1. **Stage the rollout rather than launching universally.** The activation
   improvement is clear, but the D60 subscription-retention estimate is not yet
   precise enough for an unconditional rollout.
2. **Preserve a randomized holdout.** Continue measuring D60 subscription and
   engaged retention until the lower interval clears the agreed
   non-inferiority margin.
3. **Keep the strongest experience components.** Guided calibration and early
   insight education moved; device pairing did not.
4. **Do not target from these subgroup cuts yet.** Segment differences are
   exploratory and may reflect sampling noise.

The complete validation report is saved in `validation/validation_report.md`.
"""
        ),
        code("connection.close()"),
    ]

    NOTEBOOK_PATH.parent.mkdir(parents=True, exist_ok=True)
    client = NotebookClient(
        notebook,
        timeout=180,
        kernel_name="python3",
        resources={"metadata": {"path": str(ROOT)}},
    )
    executed = client.execute()
    nbf.write(executed, NOTEBOOK_PATH)
    print(f"Executed notebook written to {NOTEBOOK_PATH}")


if __name__ == "__main__":
    main()
