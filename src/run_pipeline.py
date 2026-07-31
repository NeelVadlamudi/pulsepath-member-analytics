"""Run the DuckDB analytical pipeline and export reviewed dashboard datasets."""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy.stats import norm


ROOT = Path(__file__).resolve().parents[1]
SQL_DIR = ROOT / "sql"
PROCESSED_DIR = ROOT / "data" / "processed"
DATABASE_PATH = PROCESSED_DIR / "pulsepath.duckdb"


def difference_in_proportions(
    treatment_successes: int,
    treatment_n: int,
    control_successes: int,
    control_n: int,
    confidence: float = 0.95,
) -> dict[str, float]:
    treatment_rate = treatment_successes / treatment_n
    control_rate = control_successes / control_n
    difference = treatment_rate - control_rate
    standard_error = np.sqrt(
        treatment_rate * (1 - treatment_rate) / treatment_n
        + control_rate * (1 - control_rate) / control_n
    )
    z_value = norm.ppf(0.5 + confidence / 2)
    z_score = difference / standard_error if standard_error else 0.0
    p_value = 2 * (1 - norm.cdf(abs(z_score)))
    return {
        "treatment_rate": treatment_rate,
        "control_rate": control_rate,
        "absolute_lift": difference,
        "relative_lift": difference / control_rate if control_rate else np.nan,
        "ci_low": difference - z_value * standard_error,
        "ci_high": difference + z_value * standard_error,
        "p_value": p_value,
    }


def query_experiment_lifts(connection: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    outcomes = connection.sql(
        """
        select
            experiment_variant,
            count(*) as assigned_members,
            sum(activated_7d::integer) as activated_members,
            sum(retained_60d::integer) as retained_60d_members,
            sum(engaged_retained_60d::integer) as engaged_retained_60d_members,
            sum(device_paired_24h::integer) as paired_members,
            sum(cancelled_14d::integer) as cancelled_14d_members
        from member_outcomes
        group by 1
        order by 1
        """
    ).df().set_index("experiment_variant")

    control = outcomes.loc["Control"]
    treatment = outcomes.loc["Guided onboarding"]
    metrics = {
        "Activation within 7 days": "activated_members",
        "Subscription retention at day 60": "retained_60d_members",
        "Engaged retention at day 60": "engaged_retained_60d_members",
        "Device paired within 24 hours": "paired_members",
        "Cancellation within 14 days": "cancelled_14d_members",
    }
    rows = []
    for metric_name, success_column in metrics.items():
        result = difference_in_proportions(
            int(treatment[success_column]),
            int(treatment["assigned_members"]),
            int(control[success_column]),
            int(control["assigned_members"]),
        )
        rows.append({"metric": metric_name, **result})
    return pd.DataFrame(rows)


def build_dashboard_snapshot(
    connection: duckdb.DuckDBPyConnection,
    lifts: pd.DataFrame,
) -> dict:
    overall = connection.sql(
        """
        select
            experiment_variant as variant,
            assigned_members as members,
            activation_rate as activationRate,
            retained_60d_rate as retentionRate,
            engaged_retained_60d_rate as engagedRetentionRate,
            device_pair_rate as pairRate,
            calibration_rate as calibrationRate,
            cancellation_14d_rate as cancellationRate,
            avg_valid_wear_days_7d as validWearDays,
            avg_insight_views_7d as insightViews
        from experiment_results
        where segment_type = 'Overall'
        order by experiment_variant
        """
    ).df()

    segments = connection.sql(
        """
        select
            segment_type as segmentType,
            segment_value as segment,
            experiment_variant as variant,
            assigned_members as members,
            activation_rate as activationRate,
            retained_60d_rate as retentionRate,
            engaged_retained_60d_rate as engagedRetentionRate,
            device_pair_rate as pairRate,
            calibration_rate as calibrationRate,
            cancellation_14d_rate as cancellationRate
        from experiment_results
        where segment_type <> 'Overall'
        order by segment_type, segment_value, experiment_variant
        """
    ).df()

    trend = connection.sql(
        """
        select
            cast(signup_week as varchar) as signupWeek,
            experiment_variant as variant,
            acquisition_channel as acquisitionChannel,
            plan_tier as planTier,
            platform,
            assigned_members as members,
            activated_members as activated,
            retained_60d_members as retained60,
            engaged_retained_60d_members as engagedRetained60,
            paired_24h_members as paired24,
            calibrated_7d_members as calibrated7,
            consistent_wear_7d_members as consistentWear7,
            insight_threshold_7d_members as insightThreshold7,
            cancelled_14d_members as cancelled14,
            activation_rate as activationRate,
            retained_60d_rate as retentionRate,
            engaged_retained_60d_rate as engagedRetentionRate
        from daily_cohort_trend
        order by signup_week, experiment_variant
        """
    ).df()

    driver_funnel = connection.sql(
        """
        select
            experiment_variant as variant,
            count(*) as assigned,
            sum(device_paired_24h::integer) as paired,
            sum(calibration_completed_7d::integer) as calibrated,
            sum((valid_wear_days_7d >= 5)::integer) as consistentWear,
            sum((insight_views_7d >= 3)::integer) as insightThreshold,
            sum(activated_7d::integer) as activated,
            sum(retained_60d::integer) as retained60
        from member_outcomes
        group by 1
        order by 1
        """
    ).df()

    lift_rows = lifts.rename(
        columns={
            "treatment_rate": "treatmentRate",
            "control_rate": "controlRate",
            "absolute_lift": "absoluteLift",
            "relative_lift": "relativeLift",
            "ci_low": "ciLow",
            "ci_high": "ciHigh",
            "p_value": "pValue",
        }
    )

    metric_definitions = [
        {
            "label": "7-day activation",
            "definition": "Assigned members with at least five valid wear days, completed calibration, and at least three insight views during relative days 0–6.",
        },
        {
            "label": "D60 subscription retention",
            "definition": "Assigned members whose subscription remains active on relative day 60.",
        },
        {
            "label": "D60 engaged retention",
            "definition": "D60-retained members with at least three valid wear days during relative days 54–60, divided by all assigned members.",
        },
        {
            "label": "Absolute lift",
            "definition": "Guided-onboarding rate minus control rate, shown in percentage points.",
        },
    ]

    def records(frame: pd.DataFrame) -> list[dict]:
        cleaned = frame.replace({np.nan: None})
        return cleaned.to_dict(orient="records")

    return {
        "title": "PulsePath Member Activation & Retention",
        "generatedAt": "2026-07-30T12:00:00-04:00",
        "status": "fixture",
        "filters": [
            {
                "id": "acquisitionChannel",
                "label": "Acquisition channel",
                "field": "acquisitionChannel",
            },
            {"id": "planTier", "label": "Plan tier", "field": "planTier"},
            {"id": "platform", "label": "Platform", "field": "platform"},
        ],
        "queries": {
            "overall_experiment": {
                "rows": records(overall),
                "source": {
                    "label": "Synthetic randomized onboarding experiment",
                    "sql": "SELECT * FROM analytics.experiment_results WHERE segment_type = 'Overall';",
                    "tables": ["analytics.experiment_results"],
                    "filters": ["Complete 60-day observation window", "Intention-to-treat"],
                    "metricDefinitions": metric_definitions,
                },
            },
            "experiment_lifts": {
                "rows": records(lift_rows),
                "source": {
                    "label": "Independent difference-in-proportions validation",
                    "sql": "Computed from member-level outcomes with two-sided 95% Wald confidence intervals.",
                    "tables": ["analytics.member_outcomes"],
                    "filters": ["All assigned members", "Two-sided 95% interval"],
                    "metricDefinitions": metric_definitions,
                },
            },
            "segment_results": {
                "rows": records(segments),
                "source": {
                    "label": "Experiment results by pre-treatment segment",
                    "sql": "SELECT * FROM analytics.experiment_results WHERE segment_type <> 'Overall';",
                    "tables": ["analytics.experiment_results"],
                    "filters": ["Pre-treatment segments only", "Intention-to-treat"],
                    "metricDefinitions": metric_definitions,
                },
            },
            "cohort_trend": {
                "rows": records(trend),
                "source": {
                    "label": "Weekly signup cohorts",
                    "sql": "SELECT signup_week AS signupWeek, experiment_variant AS variant, acquisition_channel AS acquisitionChannel, plan_tier AS planTier, platform, assigned_members AS members, activated_members AS activated, retained_60d_members AS retained60, engaged_retained_60d_members AS engagedRetained60, paired_24h_members AS paired24, calibrated_7d_members AS calibrated7, consistent_wear_7d_members AS consistentWear7, insight_threshold_7d_members AS insightThreshold7, cancelled_14d_members AS cancelled14 FROM analytics.daily_cohort_trend ORDER BY signup_week;",
                    "tables": ["analytics.daily_cohort_trend"],
                    "filters": ["Complete signup cohorts only"],
                    "metricDefinitions": metric_definitions,
                },
            },
            "activation_funnel": {
                "rows": records(driver_funnel),
                "source": {
                    "label": "Activation driver counts",
                    "sql": "Aggregated from analytics.member_outcomes by experiment variant.",
                    "tables": ["analytics.member_outcomes"],
                    "filters": ["All assigned members"],
                    "metricDefinitions": metric_definitions,
                },
            },
        },
    }


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(DATABASE_PATH))
    connection.execute("set timezone = 'America/New_York'")

    for sql_file in sorted(SQL_DIR.glob("*.sql")):
        connection.execute(sql_file.read_text())
        print(f"Executed {sql_file.name}")

    connection.sql("select * from member_outcomes").df().to_csv(
        PROCESSED_DIR / "member_outcomes.csv", index=False
    )
    connection.sql("select * from experiment_results").df().to_csv(
        PROCESSED_DIR / "experiment_results.csv", index=False
    )
    connection.sql("select * from daily_cohort_trend").df().to_csv(
        PROCESSED_DIR / "daily_cohort_trend.csv", index=False
    )

    lifts = query_experiment_lifts(connection)
    lifts.to_csv(PROCESSED_DIR / "experiment_lifts.csv", index=False)

    snapshot = build_dashboard_snapshot(connection, lifts)
    snapshot_path = ROOT / "dashboard" / "src" / "data.json"
    snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False))

    print(f"Database written to {DATABASE_PATH}")
    print(f"Dashboard snapshot written to {snapshot_path}")
    print(lifts.to_string(index=False))
    connection.close()


if __name__ == "__main__":
    main()
