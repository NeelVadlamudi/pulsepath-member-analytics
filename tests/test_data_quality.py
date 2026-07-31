"""High-signal data-quality checks for the synthetic analytical pipeline."""

from pathlib import Path

import duckdb


ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / "data" / "processed" / "pulsepath.duckdb"


def connection() -> duckdb.DuckDBPyConnection:
    assert DATABASE_PATH.exists(), "Run src/run_pipeline.py before the tests."
    return duckdb.connect(str(DATABASE_PATH), read_only=True)


def scalar(sql: str):
    with connection() as database:
        return database.execute(sql).fetchone()[0]


def test_member_key_is_unique_and_complete():
    assert scalar("select count(*) from stg_members") == 6_000
    assert scalar("select count(distinct member_id) from stg_members") == 6_000
    assert scalar("select count(*) from stg_members where member_id is null") == 0


def test_daily_activity_has_expected_grain():
    assert scalar("select count(*) from stg_daily_activity") == 6_000 * 90
    assert (
        scalar(
            """
            select count(*) from (
                select member_id, relative_day, count(*) as row_count
                from stg_daily_activity
                group by 1, 2
                having count(*) <> 1
            )
            """
        )
        == 0
    )


def test_member_day_integrity_and_ranges():
    assert (
        scalar(
            """
            select count(*)
            from stg_daily_activity d
            left join stg_members m using (member_id)
            where m.member_id is null
            """
        )
        == 0
    )
    assert scalar("select count(*) from stg_daily_activity where wear_hours < 0 or wear_hours > 24") == 0
    assert scalar("select count(*) from stg_daily_activity where relative_day < 0 or relative_day > 89") == 0
    assert scalar("select count(*) from stg_daily_activity where insight_views < 0") == 0


def test_activation_inputs_are_complete():
    required_nulls = scalar(
        """
        select count(*)
        from member_outcomes
        where valid_wear_days_7d is null
           or insight_views_7d is null
           or calibration_completed_7d is null
           or activated_7d is null
           or retained_60d is null
        """
    )
    assert required_nulls == 0


def test_experiment_assignment_is_balanced():
    counts = {}
    with connection() as database:
        counts = dict(
            database.execute(
                """
                select experiment_variant, count(*)
                from stg_members
                group by 1
                """
            ).fetchall()
        )
    treatment_share = counts["Guided onboarding"] / sum(counts.values())
    assert 0.47 <= treatment_share <= 0.53


def test_no_pre_assignment_activity():
    assert (
        scalar(
            """
            select count(*)
            from stg_daily_activity d
            join stg_members m using (member_id)
            where d.activity_date < m.assignment_date
            """
        )
        == 0
    )


def test_retention_definition_reconciles_to_day_60():
    assert (
        scalar(
            """
            select count(*)
            from member_outcomes o
            join stg_daily_activity d
              on o.member_id = d.member_id and d.relative_day = 60
            where o.retained_60d <> d.is_subscribed
            """
        )
        == 0
    )
