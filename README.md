# Grafana Network Weathermap Plugin (Fork)

> [!WARNING]
> This is a **fork** of the original [grafana-network-weathermap](https://github.com/knightss27/grafana-network-weathermap) by [knightss27](https://github.com/knightss27).
> It includes additional features, modernization improvements, and bug fixes not present in the upstream version.

This plugin brings customizeable and modern looking network weathermaps to Grafana. The design remains similar to the well known [PHP Network Weathermap](https://www.network-weathermap.com/), while allowing for interoperability with Grafana and easy customization.

[**Link to the WIKI!**](https://grafana-weathermap.seth.cx/) or [install the latest version](https://grafana.com/grafana/plugins/weathermap-panel/). There are a lot of customization options for the weathermap, so it's recommended that you read over the wiki (at least at a glance) to best understand how to use it!

You can also download the latest version from [Github](https://github.com/lollinoo/grafana-network-weathermap/releases/latest/) directly.

**Original Repository**: [knightss27/grafana-network-weathermap](https://github.com/knightss27/grafana-network-weathermap)

![Example Image 1](https://raw.githubusercontent.com/lollinoo/grafana-network-weathermap/main/src/img/general-example.svg)

Other examples:

![Example Image 2](https://raw.githubusercontent.com/lollinoo/grafana-network-weathermap/main/src/img/example_00.png)

![Example Image 3](https://raw.githubusercontent.com/lollinoo/grafana-network-weathermap/main/src/img/example_01.png)

![Example Image 4](https://raw.githubusercontent.com/lollinoo/grafana-network-weathermap/main/src/img/example_02.png)

## Recent Changes

### Features
- **Interactive Waypoints**: Links can now have multiple draggable waypoints for complex manual routing.
- **Draggable Labels**: Link labels can be dragged along the path ("slide-along-path") for better visibility.
- **Node Templates**: Save node styles (icon, padding, colors) as templates and apply them to other nodes.
- **Click-to-Edit**: Direct selection of nodes and links on the map for editing properties.
- **Improved Visualization**: Simplified link rendering to clean flat lines (removed legacy arrows).

### Improvements
- **Editor UX**: Reliable background click deselection, visual feedback, and persistent editor state.
- **Performance**: Significant rendering optimizations (memoization, immutable state) for smoother interaction.
- **Security**: Hardened URL handling and safe-link navigation.
- **Modernization**: Upgraded to Node 24.13, Grafana 12, React 18, and TypeScript 5.2.
- **Ops**: Added comprehensive release checklists and migration guides.

## Local install on a recent Grafana instance

Build the plugin:

```bash
npm ci
npm run build
```

Install the built plugin in Grafana:

```bash
mkdir -p /var/lib/grafana/plugins/weathermap-panel
cp -R dist/* /var/lib/grafana/plugins/weathermap-panel/
```

Allow loading the unsigned plugin (required for local testing):

```ini
[plugins]
allow_loading_unsigned_plugins = weathermap-panel
```

Or with Docker:

```bash
docker run -d --name grafana \
  -p 3000:3000 \
  -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=weathermap-panel \
  -v "$(pwd)/dist:/var/lib/grafana/plugins/weathermap-panel" \
  grafana/grafana:latest
```

## Maintenance docs

- [Release Checklist](./RELEASE_CHECKLIST.md)
- [Migration and Compatibility Guide](./MIGRATION_COMPATIBILITY_GUIDE.md)


