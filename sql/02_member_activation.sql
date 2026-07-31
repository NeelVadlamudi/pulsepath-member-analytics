-- Derive seven-day activation from observable behavior, not generated labels.
create or replace table member_activation as
with early_behavior as (
    select
        member_id,
        count(*) filter (where valid_wear_day and relative_day between 0 and 6)
            as valid_wear_days_7d,
        sum(insight_views) filter (where relative_day between 0 and 6)
            as insight_views_7d,
        count(*) filter (where sleep_recorded and relative_day between 0 and 6)
            as sleep_days_7d,
        count(*) filter (where coaching_opened and relative_day between 0 and 6)
            as coaching_days_7d
    from stg_daily_activity
    group by 1
)
select
    m.*,
    e.valid_wear_days_7d,
    e.insight_views_7d,
    e.sleep_days_7d,
    e.coaching_days_7d,
    (
        e.valid_wear_days_7d >= 5
        and m.calibration_completed_7d
        and e.insight_views_7d >= 3
    ) as activated_7d
from stg_members m
left join early_behavior e using (member_id);
