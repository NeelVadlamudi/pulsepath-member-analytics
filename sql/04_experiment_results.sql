-- Aggregate experiment KPIs at overall and stakeholder-relevant segment grains.
create or replace table experiment_results as
with segment_rows as (
    select
        experiment_variant,
        'Overall' as segment_type,
        'All members' as segment_value,
        count(*) as assigned_members,
        avg(activated_7d::integer) as activation_rate,
        avg(retained_60d::integer) as retained_60d_rate,
        avg(engaged_retained_60d::integer) as engaged_retained_60d_rate,
        avg(device_paired_24h::integer) as device_pair_rate,
        avg(calibration_completed_7d::integer) as calibration_rate,
        avg(cancelled_14d::integer) as cancellation_14d_rate,
        avg(valid_wear_days_7d) as avg_valid_wear_days_7d,
        avg(insight_views_7d) as avg_insight_views_7d
    from member_outcomes
    group by 1

    union all

    select
        experiment_variant,
        'Acquisition channel',
        acquisition_channel,
        count(*),
        avg(activated_7d::integer),
        avg(retained_60d::integer),
        avg(engaged_retained_60d::integer),
        avg(device_paired_24h::integer),
        avg(calibration_completed_7d::integer),
        avg(cancelled_14d::integer),
        avg(valid_wear_days_7d),
        avg(insight_views_7d)
    from member_outcomes
    group by 1, 3

    union all

    select
        experiment_variant,
        'Plan tier',
        plan_tier,
        count(*),
        avg(activated_7d::integer),
        avg(retained_60d::integer),
        avg(engaged_retained_60d::integer),
        avg(device_paired_24h::integer),
        avg(calibration_completed_7d::integer),
        avg(cancelled_14d::integer),
        avg(valid_wear_days_7d),
        avg(insight_views_7d)
    from member_outcomes
    group by 1, 3

    union all

    select
        experiment_variant,
        'Platform',
        platform,
        count(*),
        avg(activated_7d::integer),
        avg(retained_60d::integer),
        avg(engaged_retained_60d::integer),
        avg(device_paired_24h::integer),
        avg(calibration_completed_7d::integer),
        avg(cancelled_14d::integer),
        avg(valid_wear_days_7d),
        avg(insight_views_7d)
    from member_outcomes
    group by 1, 3
)
select * from segment_rows;

create or replace table daily_cohort_trend as
select
    date_trunc('week', signup_date)::date as signup_week,
    experiment_variant,
    acquisition_channel,
    plan_tier,
    platform,
    count(*) as assigned_members,
    sum(activated_7d::integer) as activated_members,
    sum(retained_60d::integer) as retained_60d_members,
    sum(engaged_retained_60d::integer) as engaged_retained_60d_members,
    sum(device_paired_24h::integer) as paired_24h_members,
    sum(calibration_completed_7d::integer) as calibrated_7d_members,
    sum((valid_wear_days_7d >= 5)::integer) as consistent_wear_7d_members,
    sum((insight_views_7d >= 3)::integer) as insight_threshold_7d_members,
    sum(cancelled_14d::integer) as cancelled_14d_members,
    avg(activated_7d::integer) as activation_rate,
    avg(retained_60d::integer) as retained_60d_rate,
    avg(engaged_retained_60d::integer) as engaged_retained_60d_rate
from member_outcomes
group by 1, 2, 3, 4, 5;
