-- Measure subscription and engaged retention at a stable 60-day horizon.
create or replace table member_outcomes as
with day_60_behavior as (
    select
        member_id,
        bool_or(is_subscribed) filter (where relative_day = 60)
            as retained_60d,
        count(*) filter (
            where relative_day between 54 and 60 and valid_wear_day
        ) as valid_wear_days_54_60,
        sum(insight_views) filter (
            where relative_day between 54 and 60
        ) as insight_views_54_60
    from stg_daily_activity
    group by 1
)
select
    a.*,
    d.retained_60d,
    d.valid_wear_days_54_60,
    d.insight_views_54_60,
    (
        d.retained_60d
        and d.valid_wear_days_54_60 >= 3
    ) as engaged_retained_60d,
    (a.cancellation_day is not null and a.cancellation_day <= 14)
        as cancelled_14d
from member_activation a
left join day_60_behavior d using (member_id);
