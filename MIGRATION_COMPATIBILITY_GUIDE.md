# Migration and Compatibility Guide

This guide summarizes runtime compatibility and migration notes for dashboards using the Network Weathermap panel.

## Compatibility baseline

- Grafana: recent major versions (targeting current plugin-tools baseline).
- Node.js for development/build: `24.13.x`.
- Build system: `@grafana/plugin-tools` with webpack-based build output.

## Upgrade path (maintainers)

1. Use Node `24.13.x`.
2. Install dependencies with `npm ci`.
3. Validate with `npm run verify:ci`.
4. Build with `npm run build`.
5. Deploy `dist/` into plugin directory.

## Upgrade path (Grafana operators)

1. Backup dashboards and plugin directory.
2. Replace plugin files with new `dist/` contents.
3. Keep plugin ID unchanged:
   - `knightss27-weathermap-panel`
4. Restart Grafana.
5. Open affected dashboards and verify panel rendering/editing.

## Dashboard compatibility notes

- Existing panel JSON should remain compatible with the same plugin ID.
- Internal rendering and interaction logic has been refactored into modular helpers/components.
- Link and node behavior remains functionally aligned with previous releases, with improved test coverage.

## Security behavior changes

The URL sanitization policy is stricter than older builds:

- blocked:
  - `javascript:` URLs
  - protocol-relative URLs (`//host/path`)
  - backslash-normalized URL variants
  - URLs containing control characters
- allowed:
  - `http://...`
  - `https://...`
  - relative links (for internal Grafana navigation)
  - `data:image/...` only when explicitly enabled for image fields

If a previously configured dashboard link no longer opens, validate it against the above policy and update to a safe URL format.

## Testing recommendations after migration

- Open a dashboard with existing weathermap panels.
- Verify:
  - panel background image/color rendering
  - node/link labels and arrows
  - hover tooltip graphs
  - dashboard link navigation from nodes/links
  - panel edit operations (drag, zoom, pan, grid)

## Troubleshooting

- Plugin not visible:
  - verify plugin directory name and `plugin.json` ID.
- Plugin blocked as unsigned in local environments:
  - set `allow_loading_unsigned_plugins = knightss27-weathermap-panel`.
- Rendering anomalies after upgrade:
  - clear browser cache and reload dashboard;
  - validate panel JSON does not include malformed URLs or invalid field references.
