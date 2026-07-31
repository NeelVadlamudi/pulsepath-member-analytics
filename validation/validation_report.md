# Validation Report

## Overall Assessment: Ready to share with caveats

The pipeline is internally consistent and suitable for a synthetic portfolio
case study. The guided-onboarding experiment supports a staged rollout focused
on activation, but it does not yet establish a conclusive D60 subscription
retention improvement.

## Methodology Review

- Population: all 6,000 randomized members with a complete 60-day
  observation window.
- Experiment assignment: 3,013 control and
  2,987 guided-onboarding members
  (49.8% guided).
- Primary denominator: every assigned member, preserving intention-to-treat.
- Largest pre-treatment category-share difference across channel, plan,
  platform, and age band: 1.7%.
- Confidence intervals: independent, two-sided 95% difference-in-proportions
  intervals.

## Data-Quality Findings

| Check | Evidence | Assessment |
|---|---:|---|
| Member key | 6,000 rows; 6,000 unique IDs | Pass |
| Member-day grain | 540,000 of 540,000 expected rows | Pass |
| Duplicate member-days | 0 | Pass |
| Orphan member-days | 0 | Pass |
| Required analytical nulls | 0 | Pass |
| Activation reconciliation | 0 discrepancies | Pass |
| D60 reconciliation | 0 discrepancies | Pass |
| Independent lift reconciliation | Maximum difference 0.0000000000 | Pass |

## Calculation Spot-Checks

| Metric | Control | Guided | Lift | 95% CI | Interpretation |
|---|---:|---:|---:|---:|---|
| 7-day activation | 31.9% | 40.8% | +8.9 pp | [+6.5 pp, +11.3 pp] | Clear improvement |
| D60 subscription retention | 61.9% | 62.8% | +0.9 pp | [-1.5 pp, +3.4 pp] | Inconclusive |
| D60 engaged retention | 49.4% | 52.7% | +3.4 pp | [+0.8 pp, +5.9 pp] | Positive secondary signal |
| 24-hour pairing | 92.8% | 92.1% | -0.8 pp | [-2.1 pp, +0.6 pp] | No detected material change |
| 14-day cancellation | 4.9% | 4.8% | -0.1 pp | [-1.2 pp, +1.0 pp] | No detected harm |

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
