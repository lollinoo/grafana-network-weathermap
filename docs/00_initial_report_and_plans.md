# Initial Report and Action Plan

## Metadata
- Project: `grafana-network-weathermap`
- Branch analyzed: `devs`
- Initial analysis date: `2026-02-11`
- Goal: assess the plugin's security/maintainability status and define a relaunch plan.

## Context and initial summary
This repository is a Grafana panel plugin to create and monitor a network weathermap.

During the initial analysis, clear signals of technical obsolescence and operational risk emerged:
- frontend stack pinned to Grafana 9.x, React 17, TypeScript 4.8;
- CI/CD pipeline containing legacy/deprecated parts;
- known rendering bug with orphan links;
- external URL handling without sanitization.

After Phase 0 and Phase 1 execution, runtime reliability and automation quality improved substantially, but dependency age remains a relevant risk.

## Observed technical state (baseline)
- Last upstream commit: `2023-08-24`.
- Main plugin dependencies:
  - `@grafana/ui` `9.5.3`
  - `@grafana/data` `9.5.3`
  - `react` `17.0.2`
  - `typescript` `4.8.4`
- Declared plugin compatibility: `grafanaDependency >=9.0.5`.
- Significant codebase concentrated in a few large files:
  - `src/WeathermapPanel.tsx` (~1196 lines)
  - `src/forms/PanelForm.tsx` (~559 lines)
  - `src/forms/NodeForm.tsx` (~551 lines)
  - `src/forms/LinkForm.tsx` (~499 lines)

## Key risks identified

### 1) External URL security (high priority)
Main points:
- opening user-provided links with `window.open` without scheme sanitization;
- direct use of external URLs for background images and custom icons.

Risk:
- possible navigation to malicious URLs or unsafe schemes.

### 2) Rendering stability (high priority)
Main point:
- known case `toReturn.source is undefined` with links referencing non-existing nodes.

Risk:
- runtime error and an unreliable panel under inconsistent states.

### 3) Maintainability and state predictability (medium priority)
Main point:
- many direct state mutations across forms/components.

Risk:
- hard-to-track regressions, non-deterministic behavior while editing.

### 4) Obsolete pipeline and toolchain (medium priority)
Main points:
- CI workflows with legacy actions and patterns;
- test/dev stack not aligned with recent Grafana releases.

Risk:
- fragile releases and insufficient coverage for future evolution.

### 5) Dependency vulnerability backlog (high priority)
Main points:
- dependency set is still old despite CI/runtime modernization;
- user-reported vulnerability count from local dependency scan: `45 vulnerabilities`.

Risk:
- increased medium/long-term exposure if vulnerable transitive packages remain unresolved.

## Baseline validations executed
Commands run during the work:
- `npm run lint`
- `npm run typecheck`
- `npm run test:ci`
- `npm run build`
- `npm run verify:ci`

Baseline outcome before and during Phase 0 and Phase 1: OK (with progressive hardening and CI upgrades applied).

## Action plan (roadmap)

### Phase 0 - Immediate hardening (completed)
Objectives:
- sanitize external URLs;
- harden opening external tabs (`noopener,noreferrer`);
- handle orphan links without crashing;
- remove debug logs from runtime;
- make testing on recent Grafana versions easier.

Deliverables:
- URL sanitization utilities;
- adoption of utilities in the panel and node rendering;
- runtime guard for invalid links;
- updated test docs for Grafana latest.

Status:
- completed.
- details: `docs/01_phase0_detail_diff_changes.md`.

### Phase 1 - Base technical modernization (completed)
Objectives:
- update plugin tools stack and critical dependencies;
- realign primary CI to a maintainable workflow;
- reduce the delta with recent Grafana versions.

Planned deliverables:
- bump key dependencies and test a compatibility matrix;
- a single CI pipeline with lint/typecheck/test/build;
- minimal dependency security policy.

Delivered status updates:
- `9447922`: Node 18 baseline + workflow modernization (`test`, `docs`, `release`).
- `d323b88`: unified `verify:ci` pipeline + Dependabot setup.
- `e2bf980`: scheduled security audit workflow + updated local install documentation.
- `9733e35`: Grafana latest smoke workflow (build + container boot + plugin load check).

Validation evidence:
- repeated `npm run verify:ci` successful for each Phase 1 batch.
- `npm run audit:prod` is configured in CI but could not run in this sandbox due DNS restrictions.

Status:
- completed for CI/runtime/platform modernization.
- details: `docs/03_phase1_detail_diff_changes.md`.

### Phase 1.5 - Dependency remediation and upgrade hardening (next)
Objectives:
- reduce and then eliminate high/critical vulnerabilities from current dependency tree;
- modernize core Grafana/React/typescript-related dependencies incrementally with compatibility checks;
- keep plugin behavior stable while upgrading.

Proposed deliverables:
- prioritized vulnerability matrix (direct vs transitive, severity, exploitability);
- controlled upgrade batches with per-batch validation (`verify:ci`, smoke test);
- compatibility notes for breaking changes.

Status update (2026-02-11, batch 1):
- removed duplicated tool-only dependencies from runtime `dependencies` (`prettier`, `typescript`);
- moved `postcss` to `devDependencies` to keep runtime dependency surface smaller;
- refreshed lockfile and validated with `npm run verify:ci`.
- this is the first reduction step; full vulnerability remediation still requires additional dependency upgrades.

### Phase 2 - Architectural refactor
Objectives:
- reduce complexity in the main panel;
- separate geometry computation, data mapping, rendering, and interactions;
- limit direct mutations.

Proposed deliverables:
- split `WeathermapPanel` into modules/hooks;
- immutable updates for forms/editing;
- targeted tests for critical paths.

### Phase 3 - Release quality
Objectives:
- improve real coverage for less-tested areas;
- standardize releases and operational documentation.

Proposed deliverables:
- additional tests for forms and URL security;
- release checklist;
- dashboard migration/compatibility guide.

### Phase 4 - Ongoing governance
Objectives:
- define ownership and regular maintenance.

Proposed deliverables:
- maintenance cadence;
- issue/PR handling and support policy.

## Current progress status
- Phase 0: completed (`docs/01_phase0_detail_diff_changes.md`).
- Phase 1: completed (`docs/03_phase1_detail_diff_changes.md`).
- Phase 1.5: in progress (`docs/04_phase15_detail_diff_changes.md`).
- Phases 2-4: planned, not executed yet.

## Operational notes
- There is a local, user-managed change in `docker-compose.yaml` (left as-is).
- This document should be kept as the main roadmap and updated after each new phase.
