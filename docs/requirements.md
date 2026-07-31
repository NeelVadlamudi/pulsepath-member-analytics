# Analytical Requirements

PulsePath is a fictional wearable membership product. These requirements define
the decision support needed for a guided-onboarding experiment.

| ID | User Story | Priority | Acceptance Criteria | Potential Risk |
|---|---|---|---|---|
| PP-01 | As the Product Manager, I want an agreed activation definition so that the team measures early value rather than superficial app opens. | Must have | Activation requires at least five valid wear days, completed calibration, and at least three insight views during relative days 0–6. The denominator is every assigned member. | The composite definition is a proxy for value and could hide friction in one component. |
| PP-02 | As the Product Manager, I want guided onboarding compared with control using intention-to-treat so that the rollout decision preserves randomization. | Must have | Report assigned population, rates, absolute lift, relative lift, two-sided 95% confidence interval, and p-value for activation and D60 retention. | Excluding members who fail to pair would bias the result toward successful users. |
| PP-03 | As Lifecycle Marketing, I want results segmented by acquisition channel, plan tier, and platform so that follow-up messaging can focus on addressable cohorts. | Should have | Segments are defined before treatment, show sample size and both variants, and are labeled exploratory rather than independent proof. | Multiple segment comparisons increase the chance of false positives. |
| PP-04 | As Member Experience, I want cancellation, pairing, and engaged-retention guardrails so that activation is not improved at the cost of trust or long-term value. | Must have | Dashboard shows 24-hour pairing, 14-day cancellation, D60 subscription retention, and D60 engaged retention for both variants. | Synthetic telemetry cannot represent every hardware, support, or accessibility failure. |
| PP-05 | As Analytics, I want a reproducible semantic layer and self-service dashboard so that stakeholders can inspect definitions and source queries without analyst intervention. | Should have | SQL models run from raw files, automated tests pass, dashboard filters use reviewed fields, and every component exposes provenance. | Metric drift can occur if dashboard logic diverges from modeled tables. |

## Won't Have in This Version

- Medical or clinical claims.
- Real member, product, or financial data from any company.
- A causal claim for non-randomized segment differences.
- Personalized health recommendations.
- Automated production deployment or live warehouse connectivity.
