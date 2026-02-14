# Release Checklist

This checklist is intended for maintainers preparing a production release of the plugin.

## 1. Preconditions

- Confirm you are on the correct branch and up to date with `origin`.
- Confirm Node.js `24.13.x` is active (`node -v`).
- Confirm dependencies are installed with a clean lockfile:
  - `npm ci`

## 2. Validation

- Run full CI-equivalent validation:
  - `npm run verify:ci`
- Confirm test suites pass and no new warnings/errors are introduced.
- Run a local Grafana smoke test with the built plugin:
  - plugin loads in panel picker
  - map renders correctly
  - node drag/edit and link hover tooltip behavior works

## 3. Security checks

- Run dependency audit and triage findings:
  - `npm audit`
- Confirm URL-related behavior is still protected by tests:
  - `sanitizeExternalUrl` tests pass (`src/utils.test.ts`)
- Verify no new direct `window.open(...)` usages bypass `openSafeUrl(...)`.

## 4. Artifact integrity

- Build distributable output:
  - `npm run build`
- Verify expected files in `dist/`:
  - `module.js`
  - `plugin.json`
  - `README.md`
  - `CHANGELOG.md`
- Confirm plugin ID is unchanged:
  - `weathermap-panel`

## 5. Release metadata

- Update `CHANGELOG.md` with release notes.
- Ensure `package.json` version matches intended release.
- Tag release commit with semantic version tag.

## 6. Publish

- Push branch and tags.
- Run/verify release workflow in GitHub Actions.
- If signing is enabled, ensure required secrets are available.
- Publish/verify release entry and attached artifacts.

## 7. Post-release verification

- Install released artifact in a clean Grafana instance.
- Confirm dashboard compatibility with existing weathermap panels.
- Verify no regression in:
  - panel edit mode
  - tooltip graph rendering
  - link/node dashboard navigation behavior

## 8. Rollback plan

- Keep previous signed artifact available.
- If regression is discovered:
  - publish hotfix patch release from previous known-good tag
  - document impact and workaround in release notes
