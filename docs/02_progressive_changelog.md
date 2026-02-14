# Progressive Changelog for work on branch devs

## Guidelines
- This file tracks ongoing work performed in branch `devs`.
- It should be updated for every relevant new commit.
- Recommended format: date, commit, change type, impact, validation.

## 2026-02-11

### [4653a93] feat(security): sanitize external urls and harden link opening
- Type: security.
- Scope: external URLs (dashboard link, custom icon, background image).
- Changes:
  - introduced `sanitizeExternalUrl` and `openSafeUrl` in `src/utils.ts`;
  - replaced direct `window.open(...)` calls with a hardened open;
  - added dedicated tests in `src/utils.test.ts`.
- Impact:
  - reduced risk from malicious/unsafe URLs;
  - consistent behavior for invalid URLs (ignored).
- Validation:
  - lint/typecheck/test/build OK.

### [24c9532] fix(panel): skip orphan links to avoid source/target undefined crash
- Type: critical runtime bugfix.
- Scope: link rendering in `src/WeathermapPanel.tsx`.
- Changes:
  - added guards for missing source/target;
  - introduced `buildDrawnLinks` to filter out null links;
  - updated FAQ in `website/docs/faq.md`.
- Impact:
  - removed known crash on orphan links;
  - improved robustness for inconsistent panel state.
- Validation:
  - lint/typecheck/test/build OK.

### [f11abb7] chore(runtime): remove debug console output from panel code
- Type: runtime hardening / log noise reduction.
- Scope: `src/utils.ts`, `src/forms/WeathermapBuilder.tsx`.
- Changes:
  - removed unnecessary debug `console.log`.
- Impact:
  - cleaner console output in production/test.
- Validation:
  - lint/typecheck/test OK.

### [843b0aa] chore(dev): default test stack to latest Grafana image
- Type: dev/test environment maintenance.
- Scope: `docker-compose.yaml`, `testing/README.md`.
- Changes:
  - set Grafana image default in compose to `latest`;
  - updated test docs (port and version note).
- Impact:
  - Phase 0 testing better aligned with recent Grafana releases.
- Validation:
  - lint/typecheck/test/build OK.

### [9447922] chore(ci): modernize workflows and node 18 baseline
- Type: maintenance / platform modernization.
- Scope: `.nvmrc`, `package.json`, `.github/workflows/test.yml`, `.github/workflows/docs.yml`, `.github/workflows/release.yml`.
- Changes:
  - raised local runtime baseline to Node 18;
  - updated workflows to maintained action versions;
  - replaced deprecated output handling with `$GITHUB_OUTPUT`;
  - rewrote release flow to remove broken cache logic and standardize packaging/release draft.
- Impact:
  - CI reliability and maintainability improved;
  - lower operational risk from deprecated GitHub Actions patterns.
- Validation:
  - lint/typecheck/test/build OK.

### [d323b88] chore(ci): add unified verify pipeline and dependabot
- Type: maintenance / dependency governance.
- Scope: `package.json`, `.github/workflows/test.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`.
- Changes:
  - added `verify:ci` script to enforce one quality gate (`lint`, `typecheck`, `test:ci`, `build`);
  - switched CI and release verification to use `npm run verify:ci`;
  - introduced weekly Dependabot updates for npm and GitHub Actions.
- Impact:
  - less drift between CI and release checks;
  - baseline dependency maintenance policy enabled for branch relaunch.
- Validation:
  - `npm run verify:ci` OK.

### [e2bf980] chore(security): add scheduled audit workflow and install guide
- Type: security process / operational docs.
- Scope: `package.json`, `.github/workflows/security.yml`, `README.md`.
- Changes:
  - added `audit:prod` npm script (`npm audit --omit=dev --audit-level=high`);
  - added scheduled/manual security workflow for production dependency audit;
  - documented local install flow for recent Grafana instances.
- Impact:
  - formalized recurring dependency vulnerability checks in CI;
  - installation path for local validation is now explicit.
- Validation:
  - `npm run verify:ci` OK.
  - `npm run audit:prod` blocked in sandbox (`EAI_AGAIN registry.npmjs.org`).

### [9733e35] ci(smoke): verify plugin loads on grafana latest
- Type: compatibility automation.
- Scope: `.github/workflows/grafana-smoke.yml`.
- Changes:
  - added a smoke workflow that builds the plugin and starts `grafana/grafana:latest` in Docker;
  - waits for readiness via `/api/health` and verifies plugin loading via `/api/plugins`.
- Impact:
  - continuous compatibility signal for latest Grafana in CI;
  - faster detection of runtime loading regressions.
- Validation:
  - `npm run verify:ci` OK (local batch validation).

## 2026-02-11 (documentation synchronization)

### [working-tree] docs: split phase detail documents and refresh roadmap
- Type: documentation / project governance.
- Scope: `docs/00_initial_report_and_plans.md`, `docs/01_phase0_detail_diff_changes.md`, `docs/02_progressive_changelog.md`, `docs/03_phase1_detail_diff_changes.md`.
- Changes:
  - aligned roadmap/report references to the English docs naming and actual file layout;
  - split Phase 0 and Phase 1 detailed diff tracking into separate files;
  - added explicit vulnerability backlog tracking (`45 vulnerabilities`) and introduced `Phase 1.5` as next remediation step.
- Impact:
  - cleaner operational documentation and better traceability by phase;
  - clearer transition from platform modernization to dependency remediation.
- Validation:
  - documentation update only (no code behavior change).

## 2026-02-11 (Phase 1.5 remediation batch 1)

### [26c39d5] chore(deps): reduce runtime dependency surface
- Type: dependency hygiene / vulnerability remediation starter.
- Scope: `package.json`, `package-lock.json`.
- Changes:
  - removed duplicated tool-only packages from runtime deps (`prettier`, `typescript`);
  - moved `postcss` from runtime deps to dev deps;
  - refreshed lockfile with `npm install --package-lock-only`.
- Impact:
  - smaller runtime dependency surface;
  - cleaner boundary between build-time and runtime packages.
- Validation:
  - `npm run verify:ci` OK.
  - `npm audit` still blocked in sandbox (`EAI_AGAIN registry.npmjs.org`).

## Current branch status
- Branch: `devs`
- Latest recorded code commit: `9733e35`
- Phase 0 status: completed.
- Phase 1 status: completed (platform/CI modernization).
- Phase 1.5 status: in progress (dependency vulnerability remediation).

## Template for future updates
Copy/paste and fill for each new commit:

```md
### [<hash>] <type(scope)>: <message>
- Type: <feature|fix|chore|security|refactor|docs>.
- Scope: <main file/module>.
- Changes: <key points>.
- Impact: <technical/functional effect>.
- Validation: <commands + outcome>.
```
