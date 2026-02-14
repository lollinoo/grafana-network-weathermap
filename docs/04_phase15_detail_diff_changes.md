# Changes Performed - Phase 1.5

## Document purpose
This document tracks dependency remediation and upgrade-hardening activities for Phase 1.5.

## Batch 1
- Date: `2026-02-11`
- Status: completed
- Commit: `26c39d5`
- Goal: reduce runtime dependency surface without introducing behavior regressions.

### Files touched
- `package.json`
- `package-lock.json`

### Changes applied
- Removed duplicated tool-only packages from runtime dependencies:
  - removed `prettier` from `dependencies` (already in `devDependencies`);
  - removed `typescript` from `dependencies` (already in `devDependencies`).
- Moved build-only package out of runtime dependencies:
  - moved `postcss` from `dependencies` to `devDependencies`.
- Regenerated lockfile to keep `npm ci` deterministic:
  - `npm install --package-lock-only`.

### Key diff excerpts

```json
// package.json
// Before (dependencies excerpt)
"dependencies": {
  "postcss": "^8.1.0",
  "prettier": "^2.5",
  "typescript": "^4.1.3"
}

// After
"dependencies": {
  // postcss/prettier/typescript removed from runtime deps
}

// devDependencies now include postcss
"devDependencies": {
  "postcss": "^8.1.0"
}
```

### Validation
- `npm install --package-lock-only` -> OK
- `npm run verify:ci` -> OK

### Notes
- `npm audit` endpoint is still unreachable in this sandbox (`EAI_AGAIN registry.npmjs.org`), so advisory-based vulnerability counting cannot be confirmed here.
- This batch is a hygiene step and does not replace full dependency upgrades.

## Next batch targets
- upgrade high-risk transitive trees using controlled package bumps and `overrides` where applicable;
- align Grafana/React/TypeScript ecosystem upgrades with compatibility checks.
