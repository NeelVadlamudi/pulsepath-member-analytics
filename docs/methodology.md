# Methodology and Assumptions

## Decision

Should PulsePath roll out guided onboarding to new wearable members, iterate on
it, or stop it?

## Dataset

- Fictional company and deterministic synthetic data.
- 6,000 members assigned approximately 50/50 between control and guided onboarding.
- Signups from January through March 2026.
- Ninety relative days of activity for every assigned member.
- No names, emails, precise locations, biometric readings, or other personal data.

## Design

The experiment assignment is generated independently of acquisition channel,
plan tier, platform, age band, and latent engagement. Analysis follows
intention-to-treat: failed pairing and inactive members remain in the
denominator.

Activation is calculated from observable daily behavior rather than from the
generator's intermediate labels. D60 retention is read from subscription state
on relative day 60. Confidence intervals use an unpooled Wald
difference-in-proportions calculation and are independently checked in the
notebook.

## Important Limitations

1. The data-generating process intentionally contains a treatment effect. The
   exercise tests whether the pipeline recovers and communicates that effect; it
   is not evidence about any real wearable product.
2. Segment results are exploratory. The experiment is powered for the overall
   comparison, not every channel, tier, and platform.
3. Subscription state, engagement, device behavior, and cancellation are
   simplified. Real analysis would require billing, firmware, support,
   notification, experiment-exposure, and event-quality data.
4. No medical inference is permitted. The project measures product behavior,
   not health outcomes.
