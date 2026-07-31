"""Generate deterministic synthetic data for the PulsePath portfolio case study.

PulsePath is fictional. The generated records do not represent WHOOP members,
WHOOP metrics, or any real person. The simulation intentionally creates a
plausible randomized onboarding experiment with heterogeneous member behavior.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


SEED = 20260730
MEMBER_COUNT = 6_000
OBSERVATION_DAYS = 90


def sigmoid(value: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-value))


def build_members(rng: np.random.Generator, member_count: int) -> pd.DataFrame:
    member_ids = np.arange(1, member_count + 1)
    signup_dates = pd.Timestamp("2026-01-01") + pd.to_timedelta(
        rng.integers(0, 90, member_count), unit="D"
    )

    acquisition_channel = rng.choice(
        ["Organic", "Paid Social", "Referral", "Partnerships"],
        size=member_count,
        p=[0.34, 0.29, 0.22, 0.15],
    )
    plan_tier = rng.choice(
        ["Core", "Performance", "Health+"],
        size=member_count,
        p=[0.42, 0.40, 0.18],
    )
    platform = rng.choice(["iOS", "Android"], size=member_count, p=[0.61, 0.39])
    age_band = rng.choice(
        ["18–24", "25–34", "35–44", "45–54", "55+"],
        size=member_count,
        p=[0.14, 0.31, 0.27, 0.18, 0.10],
    )

    # Randomized independently of member traits; the quality suite verifies balance.
    experiment_variant = rng.choice(
        ["Control", "Guided onboarding"], size=member_count, p=[0.50, 0.50]
    )
    treatment = (experiment_variant == "Guided onboarding").astype(float)

    channel_effect = pd.Series(acquisition_channel).map(
        {"Organic": 0.18, "Paid Social": -0.18, "Referral": 0.30, "Partnerships": 0.08}
    ).to_numpy()
    plan_effect = pd.Series(plan_tier).map(
        {"Core": -0.10, "Performance": 0.14, "Health+": 0.26}
    ).to_numpy()
    age_effect = pd.Series(age_band).map(
        {"18–24": -0.07, "25–34": 0.05, "35–44": 0.12, "45–54": 0.06, "55+": -0.08}
    ).to_numpy()
    platform_effect = np.where(platform == "iOS", 0.08, -0.04)
    latent_engagement = (
        rng.normal(0, 0.72, member_count)
        + channel_effect
        + plan_effect
        + age_effect
        + platform_effect
    )

    pair_probability = sigmoid(2.45 + 0.20 * latent_engagement + 0.02 * treatment)
    device_paired_24h = rng.binomial(1, pair_probability).astype(bool)

    calibration_probability = sigmoid(
        0.42 + 0.67 * latent_engagement + 0.22 * treatment
        + 0.65 * device_paired_24h.astype(float)
    )
    calibration_completed_7d = rng.binomial(1, calibration_probability).astype(bool)

    early_wear_probability = sigmoid(
        0.47 + 0.62 * latent_engagement + 0.15 * treatment
        + 0.44 * device_paired_24h.astype(float)
    )
    valid_wear_days_7d = rng.binomial(7, early_wear_probability)

    insight_rate = np.exp(
        0.77 + 0.35 * latent_engagement + 0.12 * treatment
        + 0.22 * calibration_completed_7d.astype(float)
    )
    insight_views_7d = np.clip(rng.poisson(insight_rate), 0, 20)

    activated_7d = (
        (valid_wear_days_7d >= 5)
        & calibration_completed_7d
        & (insight_views_7d >= 3)
    )

    # D60 subscription retention is influenced mainly by realized early value.
    # A small direct treatment effect represents guidance that remains useful
    # after activation; this is intentionally weaker than the activation effect.
    retention_probability = sigmoid(
        0.15
        + 0.48 * latent_engagement
        + 1.05 * activated_7d.astype(float)
        + 0.04 * treatment
        + np.where(acquisition_channel == "Paid Social", -0.18, 0.0)
    )
    retained_60d = rng.binomial(1, retention_probability).astype(bool)

    cancellation_day = np.full(member_count, np.nan)
    early_cancel = ~retained_60d
    cancellation_day[early_cancel] = rng.integers(8, 61, early_cancel.sum())
    late_cancel_probability = sigmoid(-2.20 - 0.32 * latent_engagement)
    late_cancel = retained_60d & (rng.random(member_count) < late_cancel_probability)
    cancellation_day[late_cancel] = rng.integers(61, 90, late_cancel.sum())

    return pd.DataFrame(
        {
            "member_id": [f"M{value:06d}" for value in member_ids],
            "signup_date": signup_dates,
            "acquisition_channel": acquisition_channel,
            "plan_tier": plan_tier,
            "platform": platform,
            "age_band": age_band,
            "experiment_name": "guided_onboarding_v1",
            "experiment_variant": experiment_variant,
            "assignment_date": signup_dates,
            "device_paired_24h": device_paired_24h,
            "calibration_completed_7d": calibration_completed_7d,
            "valid_wear_days_7d_generated": valid_wear_days_7d,
            "insight_views_7d_generated": insight_views_7d,
            "activated_7d_generated": activated_7d,
            "retained_60d_generated": retained_60d,
            "cancellation_day": pd.Series(cancellation_day).astype("Int64"),
            "latent_engagement_internal": latent_engagement,
        }
    )


def allocate_early_days(
    rng: np.random.Generator, valid_day_count: int, total_days: int = 7
) -> np.ndarray:
    result = np.zeros(total_days, dtype=bool)
    if valid_day_count:
        result[rng.choice(total_days, size=valid_day_count, replace=False)] = True
    return result


def allocate_counts(
    rng: np.random.Generator, count: int, total_days: int = 7
) -> np.ndarray:
    if count == 0:
        return np.zeros(total_days, dtype=int)
    return rng.multinomial(count, np.full(total_days, 1 / total_days))


def build_daily_activity(
    rng: np.random.Generator, members: pd.DataFrame
) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []

    for member in members.itertuples(index=False):
        relative_day = np.arange(OBSERVATION_DAYS)
        activity_date = pd.Timestamp(member.signup_date) + pd.to_timedelta(relative_day, unit="D")
        is_subscribed = np.ones(OBSERVATION_DAYS, dtype=bool)
        if pd.notna(member.cancellation_day):
            is_subscribed[relative_day >= int(member.cancellation_day)] = False

        valid_wear_day = np.zeros(OBSERVATION_DAYS, dtype=bool)
        valid_wear_day[:7] = allocate_early_days(
            rng, int(member.valid_wear_days_7d_generated)
        )

        treatment = float(member.experiment_variant == "Guided onboarding")
        later_logit = (
            0.32
            + 0.62 * member.latent_engagement_internal
            + 0.70 * float(member.activated_7d_generated)
            + 0.02 * treatment
            - 0.012 * np.maximum(relative_day - 14, 0)
        )
        later_probability = sigmoid(later_logit)
        later_draws = rng.random(OBSERVATION_DAYS - 7) < later_probability[7:]
        valid_wear_day[7:] = later_draws
        valid_wear_day &= is_subscribed

        wear_hours = np.where(
            valid_wear_day,
            np.clip(rng.normal(21.1, 1.5, OBSERVATION_DAYS), 18.0, 24.0),
            np.where(
                is_subscribed,
                np.clip(rng.normal(7.4, 5.8, OBSERVATION_DAYS), 0.0, 17.9),
                0.0,
            ),
        )
        sleep_recorded = (
            valid_wear_day
            & (
                rng.random(OBSERVATION_DAYS)
                < sigmoid(1.65 + 0.25 * member.latent_engagement_internal)
            )
        )

        insight_views = np.zeros(OBSERVATION_DAYS, dtype=int)
        insight_views[:7] = allocate_counts(
            rng, int(member.insight_views_7d_generated)
        )
        insight_views[7:] = np.where(
            valid_wear_day[7:],
            rng.poisson(
                np.clip(
                    0.45
                    + 0.18 * member.latent_engagement_internal
                    + 0.16 * float(member.activated_7d_generated),
                    0.05,
                    None,
                ),
                OBSERVATION_DAYS - 7,
            ),
            0,
        )

        coaching_opened = (
            valid_wear_day
            & (
                rng.random(OBSERVATION_DAYS)
                < sigmoid(
                    -1.15
                    + 0.34 * member.latent_engagement_internal
                    + 0.08 * treatment
                )
            )
        )
        journal_logged = (
            valid_wear_day
            & (
                rng.random(OBSERVATION_DAYS)
                < sigmoid(-1.80 + 0.27 * member.latent_engagement_internal)
            )
        )

        rows.append(
            pd.DataFrame(
                {
                    "member_id": member.member_id,
                    "activity_date": activity_date,
                    "relative_day": relative_day,
                    "is_subscribed": is_subscribed,
                    "wear_hours": np.round(wear_hours, 2),
                    "valid_wear_day": valid_wear_day,
                    "sleep_recorded": sleep_recorded,
                    "insight_views": insight_views,
                    "coaching_opened": coaching_opened,
                    "journal_logged": journal_logged,
                }
            )
        )

    return pd.concat(rows, ignore_index=True)


def main(output_dir: Path, member_count: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    members_with_generation_fields = build_members(rng, member_count)
    daily_activity = build_daily_activity(rng, members_with_generation_fields)

    members = members_with_generation_fields.drop(
        columns=[
            "valid_wear_days_7d_generated",
            "insight_views_7d_generated",
            "activated_7d_generated",
            "retained_60d_generated",
            "latent_engagement_internal",
        ]
    )
    members.to_csv(output_dir / "members.csv", index=False)
    daily_activity.to_csv(output_dir / "daily_activity.csv", index=False)

    print(f"Generated {len(members):,} synthetic members.")
    print(f"Generated {len(daily_activity):,} synthetic member-day rows.")
    print(f"Files written to {output_dir.resolve()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw"),
        help="Directory for generated CSV files.",
    )
    parser.add_argument("--member-count", type=int, default=MEMBER_COUNT)
    args = parser.parse_args()
    main(args.output_dir, args.member_count)
