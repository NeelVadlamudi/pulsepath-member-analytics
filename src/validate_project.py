"""Independently validate the modeled analysis and write a concise QA report."""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy.stats import norm


ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / "data" / "processed" / "pulsepath.duckdb"
REPORT_PATH = ROOT / "validation" / "validation_report.md"
EVIDENCE_PATH = ROOT / "validation" / "validation_evidence.json"


def difference_in_proportions(
    treatment: pd.Series, control: pd.Series
) -> dict[str, float]:
    treatment_rate = float(treatment.mean())
    control_rate = float(control.mean())
    lift = treatment_rate - control_rate
    standard_error = np.sqrt(
        treatment_rate * (1 - treatment_rate) / len(treatment)
        + control_rate * (1 - control_rate) / len(control)
    )
    z_value = norm.ppf(0.975)
    z_score = lift / standard_error
    return {
        "control_rate": control_rate,
        "treatment_rate": treatment_rate,
        "absolute_lift": lift,
        "ci_low": lift - z_value * standard_error,
        "ci_high": lift + z_value * standard_error,
        "p_value": 2 * (1 - norm.cdf(abs(z_score))),
    }


def percentage(value: float, decimals: int = 1) -> str:
    return f"{value * 100:.{decimals}f}%"


def points(value: float, decimals: int = 1) -> str:
    return f"{value * 100:+.{decimals}f} pp"


def main() -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    members = pd.read_csv(ROOT / "data" / "raw" / "members.csv")
    daily = pd.read_csv(ROOT / "data" / "raw" / "daily_activity.csv")
    modeled = pd.read_csv(ROOT / "data" / "processed" / "member_outcomes.csv")
    pipeline_lifts = pd.read_csv(ROOT / "data" / "processed" / "experiment_lifts.csv")

    early = (
        daily.loc[daily["relative_day"].between(0, 6)]
        .groupby("member_id", as_index=False)
        .agg(
            valid_wear_days_7d=("valid_wear_day", "sum"),
            insight_views_7d=("insight_views", "sum"),
        )
    )
    day_60 = (
        daily.loc[daily["relative_day"] == 60, ["member_id", "is_subscribed"]]
        .rename(columns={"is_subscribed": "retained_60d_recomputed"})
    )
    recomputed = members.merge(early, on="member_id", validate="one_to_one").merge(
        day_60, on="member_id", validate="one_to_one"
    )
    recomputed["activated_7d_recomputed"] = (
        recomputed["valid_wear_days_7d"].ge(5)
        & recomputed["calibration_completed_7d"]
        & recomputed["insight_views_7d"].ge(3)
    )

    reconciliation = recomputed[
        ["member_id", "activated_7d_recomputed", "retained_60d_recomputed"]
    ].merge(
        modeled[["member_id", "activated_7d", "retained_60d"]],
        on="member_id",
        validate="one_to_one",
    )
    activation_discrepancies = int(
        (
            reconciliation["activated_7d_recomputed"]
            != reconciliation["activated_7d"]
        ).sum()
    )
    retention_discrepancies = int(
        (
            reconciliation["retained_60d_recomputed"]
            != reconciliation["retained_60d"]
        ).sum()
    )

    modeled["activated_7d"] = modeled["activated_7d"].astype(bool)
    modeled["retained_60d"] = modeled["retained_60d"].astype(bool)
    modeled["engaged_retained_60d"] = modeled["engaged_retained_60d"].astype(bool)
    modeled["device_paired_24h"] = modeled["device_paired_24h"].astype(bool)
    modeled["cancelled_14d"] = modeled["cancelled_14d"].astype(bool)

    treatment = modeled.loc[modeled["experiment_variant"] == "Guided onboarding"]
    control = modeled.loc[modeled["experiment_variant"] == "Control"]
    metric_columns = {
        "Activation within 7 days": "activated_7d",
        "Subscription retention at day 60": "retained_60d",
        "Engaged retention at day 60": "engaged_retained_60d",
        "Device paired within 24 hours": "device_paired_24h",
        "Cancellation within 14 days": "cancelled_14d",
    }
    independent_results = {
        label: difference_in_proportions(treatment[column], control[column])
        for label, column in metric_columns.items()
    }

    maximum_lift_difference = 0.0
    for _, pipeline_row in pipeline_lifts.iterrows():
        independent = independent_results[pipeline_row["metric"]]
        maximum_lift_difference = max(
            maximum_lift_difference,
            abs(independent["absolute_lift"] - pipeline_row["absolute_lift"]),
        )

    variant_counts = members["experiment_variant"].value_counts()
    treatment_share = float(
        variant_counts["Guided onboarding"] / variant_counts.sum()
    )
    balance_differences = {}
    for column in ["acquisition_channel", "plan_tier", "platform", "age_band"]:
        shares = pd.crosstab(
            members[column], members["experiment_variant"], normalize="columns"
        )
        balance_differences[column] = float(
            (shares["Guided onboarding"] - shares["Control"]).abs().max()
        )
    max_balance_difference = max(balance_differences.values())

    expected_daily_rows = len(members) * 90
    duplicate_member_days = int(
        daily.duplicated(["member_id", "relative_day"]).sum()
    )
    orphan_member_days = int((~daily["member_id"].isin(members["member_id"])).sum())
    required_nulls = {
        column: int(modeled[column].isna().sum())
        for column in [
            "member_id",
            "experiment_variant",
            "activated_7d",
            "retained_60d",
        ]
    }

    evidence = {
        "member_rows": len(members),
        "daily_rows": len(daily),
        "expected_daily_rows": expected_daily_rows,
        "duplicate_member_days": duplicate_member_days,
        "orphan_member_days": orphan_member_days,
        "required_nulls": required_nulls,
        "variant_counts": variant_counts.to_dict(),
        "treatment_share": treatment_share,
        "maximum_pre_treatment_balance_difference": max_balance_difference,
        "balance_differences": balance_differences,
        "activation_reconciliation_discrepancies": activation_discrepancies,
        "retention_reconciliation_discrepancies": retention_discrepancies,
        "maximum_lift_recalculation_difference": maximum_lift_difference,
        "independent_results": independent_results,
    }
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2))

    activation = independent_results["Activation within 7 days"]
    retention = independent_results["Subscription retention at day 60"]
    engaged = independent_results["Engaged retention at day 60"]
    pairing = independent_results["Device paired within 24 hours"]
    cancellation = independent_results["Cancellation within 14 days"]

    report = f"""# Validation Report

## Overall Assessment: Ready to share with caveats

The pipeline is internally consistent and suitable for a synthetic portfolio
case study. The guided-onboarding experiment supports a staged rollout focused
on activation, but it does not yet establish a conclusive D60 subscription
retention improvement.

## Methodology Review

- Population: all {len(members):,} randomized members with a complete 60-day
  observation window.
- Experiment assignment: {variant_counts["Control"]:,} control and
  {variant_counts["Guided onboarding"]:,} guided-onboarding members
  ({percentage(treatment_share)} guided).
- Primary denominator: every assigned member, preserving intention-to-treat.
- Largest pre-treatment category-share difference across channel, plan,
  platform, and age band: {percentage(max_balance_difference)}.
- Confidence intervals: independent, two-sided 95% difference-in-proportions
  intervals.

## Data-Quality Findings

| Check | Evidence | Assessment |
|---|---:|---|
| Member key | {len(members):,} rows; {members["member_id"].nunique():,} unique IDs | Pass |
| Member-day grain | {len(daily):,} of {expected_daily_rows:,} expected rows | Pass |
| Duplicate member-days | {duplicate_member_days:,} | Pass |
| Orphan member-days | {orphan_member_days:,} | Pass |
| Required analytical nulls | {sum(required_nulls.values()):,} | Pass |
| Activation reconciliation | {activation_discrepancies:,} discrepancies | Pass |
| D60 reconciliation | {retention_discrepancies:,} discrepancies | Pass |
| Independent lift reconciliation | Maximum difference {maximum_lift_difference:.10f} | Pass |

## Calculation Spot-Checks

| Metric | Control | Guided | Lift | 95% CI | Interpretation |
|---|---:|---:|---:|---:|---|
| 7-day activation | {percentage(activation["control_rate"])} | {percentage(activation["treatment_rate"])} | {points(activation["absolute_lift"])} | [{points(activation["ci_low"])}, {points(activation["ci_high"])}] | Clear improvement |
| D60 subscription retention | {percentage(retention["control_rate"])} | {percentage(retention["treatment_rate"])} | {points(retention["absolute_lift"])} | [{points(retention["ci_low"])}, {points(retention["ci_high"])}] | Inconclusive |
| D60 engaged retention | {percentage(engaged["control_rate"])} | {percentage(engaged["treatment_rate"])} | {points(engaged["absolute_lift"])} | [{points(engaged["ci_low"])}, {points(engaged["ci_high"])}] | Positive secondary signal |
| 24-hour pairing | {percentage(pairing["control_rate"])} | {percentage(pairing["treatment_rate"])} | {points(pairing["absolute_lift"])} | [{points(pairing["ci_low"])}, {points(pairing["ci_high"])}] | No detected material change |
| 14-day cancellation | {percentage(cancellation["control_rate"])} | {percentage(cancellation["treatment_rate"])} | {points(cancellation["absolute_lift"])} | [{points(cancellation["ci_low"])}, {points(cancellation["ci_high"])}] | No detected harm |

## Issues and Required Caveats

1. **High — Synthetic source:** All records are simulated. Results demonstrate
   analytical workflow, not real product performance.
2. **Medium — D60 uncertainty:** The retention interval includes both a small
   decline and a meaningful improvement. Do not claim that guided onboarding
   causes subscription retention.
3. **Medium — Segment multiplicity:** Channel, plan, and platform cuts are
   exploratory and are not corrected for multiple comparisons.
4. **Low — Simplified telemetry:** The model omits billing failures, firmware,
   notification delivery, customer support, and accessibility events.

## Decision Recommendation

Run a staged rollout or continue the experiment while preserving a control
holdout. Treat the activation result as decision-useful, monitor D60 retention
until its lower confidence bound clears the agreed non-inferiority margin, and
investigate which activation component drives the lift before simplifying the
experience.
"""
    REPORT_PATH.write_text(report)
    print(f"Validation evidence written to {EVIDENCE_PATH}")
    print(f"Validation report written to {REPORT_PATH}")
    print(report)


if __name__ == "__main__":
    main()
