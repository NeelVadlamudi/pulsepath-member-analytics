# Metric Dictionary

All metrics use an intention-to-treat denominator: every member assigned to an
experiment variant, regardless of pairing, exposure, or later activity.

| Metric | Type | Definition | Decision Use | Guardrail / Caveat |
|---|---|---|---|---|
| 7-day activation | Primary KPI | Member has at least five valid wear days, completes calibration, and views at least three insights during relative days 0–6. | Decide whether guided onboarding improves early value realization. | Composite proxy; inspect every component before rollout. |
| D60 subscription retention | Secondary outcome | Subscription is active on relative day 60 divided by all assigned members. | Check whether activation improvement persists into business value. | Synthetic cancellation behavior; no billing failures or pauses. |
| D60 engaged retention | Secondary outcome | Subscription active on day 60 and at least three valid wear days during days 54–60, divided by all assigned members. | Separate paid-but-inactive members from members still realizing value. | Threshold is a portfolio assumption, not an industry standard. |
| Device pairing within 24 hours | Driver / guardrail | Member completed device pairing during the first 24 hours. | Detect hardware setup friction. | Does not measure pairing retries or support contacts. |
| Calibration completion | Driver | Member completed initial calibration by day 7. | Identify whether guidance removes setup ambiguity. | Completion does not guarantee understanding. |
| Consistent early wear | Driver | At least five valid wear days during relative days 0–6. | Confirm that activation lift reflects data continuity. | Valid means at least 18 wear hours in this simulation. |
| 14-day cancellation | Guardrail | Cancellation occurs on or before relative day 14. | Detect early dissatisfaction or excessive onboarding friction. | Does not model refunds or payment failures. |

## Experiment Decision Rule

Recommend rollout only when:

1. The 7-day activation lift is positive and its two-sided 95% confidence
   interval excludes zero.
2. D60 subscription retention is not worse by more than one percentage point.
3. Device pairing and 14-day cancellation show no material adverse movement.
4. Segment findings are treated as exploratory unless separately powered and
   corrected for multiple comparisons.
