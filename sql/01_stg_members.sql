-- Standardize synthetic member attributes and experiment assignment.
create or replace table stg_members as
select
    cast(member_id as varchar) as member_id,
    cast(signup_date as date) as signup_date,
    cast(acquisition_channel as varchar) as acquisition_channel,
    cast(plan_tier as varchar) as plan_tier,
    cast(platform as varchar) as platform,
    cast(age_band as varchar) as age_band,
    cast(experiment_name as varchar) as experiment_name,
    cast(experiment_variant as varchar) as experiment_variant,
    cast(assignment_date as date) as assignment_date,
    cast(device_paired_24h as boolean) as device_paired_24h,
    cast(calibration_completed_7d as boolean) as calibration_completed_7d,
    cast(cancellation_day as integer) as cancellation_day
from read_csv_auto('data/raw/members.csv', header = true);

create or replace table stg_daily_activity as
select
    cast(member_id as varchar) as member_id,
    cast(activity_date as date) as activity_date,
    cast(relative_day as integer) as relative_day,
    cast(is_subscribed as boolean) as is_subscribed,
    cast(wear_hours as double) as wear_hours,
    cast(valid_wear_day as boolean) as valid_wear_day,
    cast(sleep_recorded as boolean) as sleep_recorded,
    cast(insight_views as integer) as insight_views,
    cast(coaching_opened as boolean) as coaching_opened,
    cast(journal_logged as boolean) as journal_logged
from read_csv_auto('data/raw/daily_activity.csv', header = true);
