# Changes Performed - Phase 1

## Document purpose
This document tracks in detail the changes performed in Phase 1, including key code/config blocks added and removed.

## Commit 5
- Hash: `9447922`
- Message: `chore(ci): modernize workflows and node 18 baseline`
- Date: `2026-02-11`

### Files touched
- `.nvmrc`
- `package.json`
- `.github/workflows/test.yml`
- `.github/workflows/docs.yml`
- `.github/workflows/release.yml`

### Blocks changed (key excerpts)

```txt
# .nvmrc
# Before
16
# After
18
```

```json
// package.json
// Before
"engines": { "node": ">=14" }
// After
"engines": { "node": ">=18" }
```

```yaml
# .github/workflows/test.yml
# Before
uses: actions/checkout@v3
uses: actions/setup-node@v3
node-version: '16'
run: npm install -g npm

# After
uses: actions/checkout@v4
uses: actions/setup-node@v4
node-version-file: '.nvmrc'
cache: 'npm'
```

```yaml
# .github/workflows/docs.yml
# Before
uses: actions/checkout@v2
uses: actions/setup-python@v2
uses: crazy-max/ghaction-github-pages@v2

# After
uses: actions/checkout@v4
uses: actions/setup-python@v5
uses: peaceiris/actions-gh-pages@v4
permissions:
  contents: write
```

```yaml
# .github/workflows/release.yml
# Before
- deprecated set-output API
- broken cache references to yarn.lock
- legacy action versions

# After
- actions/checkout@v4 + actions/setup-node@v4
- node-version-file: '.nvmrc'
- npm cache + npm ci
- metadata via $GITHUB_OUTPUT
- release via softprops/action-gh-release@v2
```

## Commit 6
- Hash: `d323b88`
- Message: `chore(ci): add unified verify pipeline and dependabot`
- Date: `2026-02-11`

### Files touched
- `package.json`
- `.github/workflows/test.yml`
- `.github/workflows/release.yml`
- `.github/dependabot.yml`

### Blocks changed (key excerpts)

```json
// package.json
// Added
"verify:ci": "npm run lint && npm run typecheck && npm run test:ci && npm run build"
```

```yaml
# .github/workflows/test.yml
# Before
- run: npm run test:ci
- run: npm run build

# After
name: CI
- run: npm run verify:ci
```

```yaml
# .github/workflows/release.yml
# Before
- name: Run tests
  run: npm run test:ci
- name: Build plugin
  run: npm run build

# After
- name: Run CI verification
  run: npm run verify:ci
```

```yaml
# .github/dependabot.yml (new file)
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

## Commit 7
- Hash: `e2bf980`
- Message: `chore(security): add scheduled audit workflow and install guide`
- Date: `2026-02-11`

### Files touched
- `package.json`
- `.github/workflows/security.yml`
- `README.md`

### Blocks changed (key excerpts)

```json
// package.json
// Added
"audit:prod": "npm audit --omit=dev --audit-level=high"
```

```yaml
# .github/workflows/security.yml (new file)
name: Security
on:
  schedule:
    - cron: '0 5 * * 1'
  workflow_dispatch:
jobs:
  npm-audit:
    steps:
      - run: npm ci
      - run: npm run audit:prod
```

```md
# README.md (new section)
## Local install on a recent Grafana instance
- build plugin with `npm ci` + `npm run build`;
- copy `dist/*` to `/var/lib/grafana/plugins/knightss27-weathermap-panel/`;
- allow unsigned plugin loading for local tests;
- docker run example for `grafana/grafana:latest`.
```

## Commit 8
- Hash: `9733e35`
- Message: `ci(smoke): verify plugin loads on grafana latest`
- Date: `2026-02-11`

### Files touched
- `.github/workflows/grafana-smoke.yml`

### Blocks changed (key excerpts)

```yaml
# .github/workflows/grafana-smoke.yml (new file)
name: Grafana Smoke
jobs:
  smoke:
    name: Build and boot on latest Grafana
    steps:
      - run: npm ci
      - run: npm run build
      - run: docker run ... grafana/grafana:latest
      - run: curl -sf http://127.0.0.1:3300/api/health
      - run: curl -sf -u admin:admin http://127.0.0.1:3300/api/plugins | jq -e ...
```

## Validations executed for Phase 1
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run test:ci` -> OK
- `npm run build` -> OK
- `npm run verify:ci` -> OK
- `npm run audit:prod` -> blocked in sandbox (`EAI_AGAIN registry.npmjs.org`)

## Risk follow-up opened after Phase 1
- User-reported current vulnerability count from local dependency scan: `45 vulnerabilities`.
- Next planned remediation phase: `Phase 1.5` (dependency upgrade and vulnerability reduction).
