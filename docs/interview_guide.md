# Interview Guide

## 60-Second Walkthrough

I built a product analytics case study for a fictional wearable membership
company deciding whether to roll out guided onboarding. I started by defining
activation as realized early value—not app opens—and kept every randomized
member in the denominator, including people who failed to pair or disengaged.

The experiment increased 7-day activation by 8.9 percentage points. D60
subscription retention was directionally positive but inconclusive, while
engaged retention improved by 3.4 points and the early guardrails showed no
detected harm. I therefore recommended a staged rollout with a persistent
control holdout rather than a universal launch.

The project includes layered SQL models, automated data-quality tests, an
executed notebook, independent statistical reconciliation, an interactive
dashboard, metric documentation, and a decision log explaining assumptions I
rejected.

## What Was the Hardest Analytical Decision?

The difficult part was choosing what counted as success. App opens and event
volume were easy to measure but weak proxies for product value. I defined
activation as consistent wear, completed calibration, and early insight
consumption, then paired it with subscription and engaged-retention outcomes.

## Why Intention-to-Treat?

Filtering to members who paired a device would remove some of the exact
friction onboarding is supposed to solve. It would also condition on
post-assignment behavior and break the experimental comparison.

## Why Not Recommend a Full Rollout?

The primary activation interval was clearly positive, but the D60 subscription
retention interval included a decline larger than the pre-agreed
non-inferiority margin. A staged rollout captures likely near-term value while
preserving the evidence needed for the longer-term decision.

## What Would Change With Real Company Data?

I would add:

- Verified assignment and exposure events
- Billing state, pauses, refunds, and payment failures
- Firmware and device-pairing error taxonomy
- Notification delivery and message-treatment logs
- Support-contact and replacement-device outcomes
- Accessibility and platform-version cuts
- Longer retention windows and pre-experiment power calculations

## First Question on Day One

What member decision or product tradeoff is currently important but difficult
to answer because the metric definition, data quality, or ownership is unclear?
