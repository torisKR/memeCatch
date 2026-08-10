# GLO-003 acceptance criteria — global onboarding recovery path

1. The Plus trend-alert “manage interests” action targets the existing authenticated `/onboarding` route, returning to `/premium`; it must not link to a nonexistent route.
2. The onboarding form reads the active UI locale and presents localized heading, explanatory text, nickname field, interest choices, age choices, skip action, and pending submit state for every supported UI locale.
3. Existing onboarding form semantics remain intact: selected display categories expand to their existing legacy values, age is optional, and the server action plus `safeNext` redirect contract are unchanged.
4. The change adds no profile writes beyond the existing form submit, no schema/migration/analytics change, no production content operation, and no new locale-prefixed route.
5. Unit/component regressions prove the recovery link, English rendered form copy, category-expansion behavior, full copy fallback completeness, and existing quality gates.
