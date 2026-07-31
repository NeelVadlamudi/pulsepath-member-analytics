# Business Analyst Walkthrough

This guide explains how the PulsePath project moves from an ambiguous product request to a defensible business decision. It is written for business analysts, product analysts, hiring managers, and stakeholders who want to inspect the reasoning—not only the code.

## 1. Start with the decision, not the dashboard

Weak framing:

> Build a dashboard showing onboarding and retention.

Decision framing used here:

> Should guided onboarding become the default experience for new wearable members, and what evidence would make that rollout acceptable?

The second version establishes a decision owner, an intervention, a population, a comparison, an action, and an evidence threshold. That determines which metrics and requirements matter.

## 2. Define what the organization is trying to prove

| Claim | Measurement | Why it matters |
|---|---|---|
| Guided onboarding improves early member value | Activation during days 0–6 | Leading indicator that members reach the product’s first meaningful outcome |
| It does not damage the subscription outcome | Paid subscription active on day 60 | Protects the recurring-membership business model |
| It supports durable product use | Active subscription plus valid wear during days 54–60 | Distinguishes billing retention from continued use |
| It does not introduce operational harm | Pairing within 24 hours and cancellation within 14 days | Prevents a strong headline metric from hiding setup or cancellation problems |

The project does not claim revenue impact because acquisition volume, price, margin, implementation cost, and lifetime value are not provided.

## 3. Translate concepts into metric contracts

### Primary KPI: activated by day 7

A member is activated only when all three conditions occur during relative days 0–6:

1. Calibration is completed.
2. At least five days contain valid wear.
3. At least three insights are viewed.

The denominator is every randomly assigned member—not only people who completed setup. This intention-to-treat approach avoids making the experience appear better by excluding unsuccessful members.

### Secondary outcomes

- **Paid membership on day 60:** subscription is active on relative day 60.
- **Active use around day 60:** paid membership is active and at least three valid-wear days occur during days 54–60.

### Guardrails

- Device paired within 24 hours.
- Cancellation within 14 days.

Exact calculations, ownership questions, and decision uses are documented in [metric_dictionary.md](metric_dictionary.md).

## 4. Establish the decision rule before reading results

A broad rollout requires:

1. A positive, statistically supported activation improvement.
2. A day-60 paid-retention interval whose lower bound is above −1 percentage point.
3. No detected material deterioration in pairing or cancellation.

The −1-point non-inferiority margin is a business risk tolerance. In plain language, the organization is unwilling to accept evidence consistent with losing more than 10 retained subscriptions per 1,000 members.

Because the retention interval is −1.5 to +3.4 points, the broad-rollout rule is not met—even though the point estimate is positive.

## 5. Convert stakeholder needs into requirements

The detailed requirements use INVEST-oriented user stories, MoSCoW priority, testable acceptance criteria, and risks. See [requirements.md](requirements.md).

| Requirement area | Priority | Business rationale |
|---|---|---|
| Reproducible member-level outcome model | Must | Every displayed result must reconcile to a stable member denominator |
| Activation and retention comparison | Must | Directly supports the rollout decision |
| Guardrail monitoring | Must | Prevents local optimization that harms setup or cancellation |
| Segment exploration | Should | Generates follow-up hypotheses without controlling the overall decision |
| Self-service source inspection | Could | Helps technical stakeholders audit definitions and SQL |
| Medical or physiological recommendations | Won’t | Outside the dataset, product decision, and permitted claim boundary |

## 6. Build a traceable data model

```text
Assigned member
    ├── experiment experience
    ├── pre-treatment attributes
    └── relative member-day activity
             ↓
       one member outcome row
             ↓
       experiment comparison
```

The key controls are:

- one row per member in the outcome model;
- one row per member per relative day in activity data;
- complete observation coverage;
- pre-treatment segmentation fields only;
- consistent denominators across SQL, notebook, validation, and dashboard.

## 7. Validate before recommending

The project checks:

- unique member keys;
- complete member-day grain;
- no orphan activity rows;
- no required analytical nulls;
- activation and day-60 reconciliation;
- experimental allocation balance;
- independently recalculated lifts and confidence intervals.

The [validation report](../validation/validation_report.md) is separate from the main notebook so the recommendation is not supported only by the same code that produced it.

## 8. Communicate one evidence model to different audiences

### For non-technical stakeholders

Lead with people affected:

- 89 more activated members per 1,000 signups.
- Day-60 paid membership could plausibly range from 15 fewer to 34 more per 1,000.
- Expand gradually and preserve a comparison group.

### For technical stakeholders

Preserve:

- exact percentages and denominators;
- percentage-point differences;
- confidence intervals;
- SQL and reviewed rows;
- assumptions and decision thresholds.

The dashboard uses progressive disclosure: plain language is visible first, while technical definitions and source details remain available instead of being removed.

## 9. Challenge attractive findings

A strong analyst should not accept a large favorable result merely because it supports the desired outcome.

During development, the first synthetic treatment effect was unrealistically large. The data-generating assumptions were challenged and recalibrated before the project was finalized. The goal is a believable decision exercise, not a portfolio result engineered to look perfect.

The final recommendation also resists a common failure: treating a positive retention estimate as proof when its uncertainty interval still crosses the agreed downside boundary.

## 10. Operational bottlenecks

| Bottleneck | Why it matters in a real implementation |
|---|---|
| Exposure logging | Assignment does not prove the intended onboarding version was delivered |
| Device pairing instrumentation | Pairing can block value before the guidance experience begins |
| Billing-state definitions | Pauses, payment recovery, refunds, and grace periods can change “active” status |
| Cross-platform consistency | iOS and Android event definitions must match |
| Experiment governance | Assignment, exclusions, stopping rules, and rollout changes require ownership |
| Support readiness | Guidance may change member questions, contact volume, and troubleshooting demand |

## 11. Data privacy and ethics risks

- Wearable telemetry can become sensitive even when names are removed.
- Device, account, and subscription identifiers require access control and retention policies.
- Product analytics should not be repurposed for medical inference without appropriate evidence and governance.
- Small segments can create re-identification risk and misleading comparisons.
- This public repository therefore uses synthetic records and excludes personal, location, biometric, and health data.

## 12. Hidden assumptions to state explicitly

- Random assignment was implemented correctly.
- There was no meaningful interference between members.
- Event definitions remained stable during the experiment.
- Members have complete day-60 follow-up.
- The non-inferiority margin was selected before reviewing results.
- Segment characteristics were recorded before treatment.
- The simulated behavior is not evidence about a real wearable company.

## 13. What each artifact proves

| Artifact | Evidence of BA capability |
|---|---|
| Requirements | Stakeholder needs translated into prioritized, testable behavior |
| Metric dictionary | Ambiguous business language converted into measurable contracts |
| Decision log | Tradeoffs and rejected alternatives made visible |
| SQL models | Requirements traced into reproducible transformations |
| Notebook | Analytical reasoning and uncertainty communicated transparently |
| Tests and validation | Quality risks addressed before recommendation |
| Dashboard | Mixed-audience communication and self-service exploration |
| Interview guide | Concise stakeholder narrative and handling of objections |

## 14. Questions a reviewer should ask

1. Who owns the non-inferiority margin, and why is −1 point acceptable?
2. How would billing pauses and failed payments change the day-60 definition?
3. What sample size or additional observation would be needed for the next decision?
4. How would you monitor instrumentation drift during rollout?
5. Which segment findings are plausible hypotheses, and which may be noise?
6. What operational cost or support burden could offset the activation benefit?
7. What evidence would justify ending the holdout?

These are strengths of the project, not missing decoration. A mature business analyst makes decision risk visible and invites the right follow-up questions.
