# Changes Performed - Phase 0

## Document purpose
This document tracks in detail the changes performed in Phase 0, including code blocks added and removed.

## Commit 1
- Hash: `4653a93`
- Message: `feat(security): sanitize external urls and harden link opening`

### Files touched
- `src/utils.ts`
- `src/utils.test.ts`
- `src/WeathermapPanel.tsx`
- `src/components/MapNode.tsx`

### Blocks added (key excerpts)

```ts
// src/utils.ts
const URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

interface SanitizeExternalUrlOptions {
  allowRelative?: boolean;
  allowDataImage?: boolean;
}

export function sanitizeExternalUrl(
  rawUrl: string | undefined,
  options: SanitizeExternalUrlOptions = {}
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const allowRelative = options.allowRelative ?? true;
  const allowDataImage = options.allowDataImage ?? false;
  const lowerValue = trimmed.toLowerCase();

  if (allowDataImage && lowerValue.startsWith('data:image/')) {
    return trimmed;
  }

  if (!URL_SCHEME_REGEX.test(trimmed)) {
    return allowRelative ? trimmed : undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch (e) {
    return undefined;
  }

  return undefined;
}

export function openSafeUrl(rawUrl: string | undefined): void {
  const safeUrl = sanitizeExternalUrl(rawUrl, { allowRelative: true });
  if (!safeUrl) {
    return;
  }

  const popup = window.open(safeUrl, '_blank', 'noopener,noreferrer');
  if (popup) {
    popup.opener = null;
  }
}
```

```ts
// src/WeathermapPanel.tsx (uses utilities)
import { openSafeUrl, sanitizeExternalUrl } from 'utils';

const safeBackgroundImageUrl = sanitizeExternalUrl(wm.settings.panel.backgroundImage?.url, {
  allowRelative: true,
  allowDataImage: true,
});
```

```ts
// src/components/MapNode.tsx (uses utilities)
const safeNodeDashboardLink = sanitizeExternalUrl(node.dashboardLink, { allowRelative: true });
const safeIconSrc = sanitizeExternalUrl(node.nodeIcon?.src, { allowRelative: true, allowDataImage: true });
```

```ts
// src/utils.test.ts (new tests)
test('sanitizeExternalUrl only allows safe schemes', () => {
  expect(sanitizeExternalUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  expect(sanitizeExternalUrl('/d/network-overview')).toBe('/d/network-overview');
  expect(sanitizeExternalUrl('javascript:alert(1)')).toBeUndefined();
  expect(sanitizeExternalUrl('data:text/html;base64,SGVsbG8=')).toBeUndefined();
  expect(sanitizeExternalUrl('data:image/svg+xml;base64,SGVsbG8=', { allowDataImage: true })).toBe(
    'data:image/svg+xml;base64,SGVsbG8='
  );
});
```

### Blocks removed/replaced (excerpts)

```ts
// Before
window.open(d.sides.A.dashboardLink, '_blank');

// After
openSafeUrl(safeADashboardLink);
```

```ts
// Before
backgroundImage: wm.settings.panel.backgroundImage
  ? `url(${wm.settings.panel.backgroundImage.url})`
  : 'none',

// After
backgroundImage: wm.settings.panel.backgroundImage
  ? safeBackgroundImageUrl
    ? `url(${safeBackgroundImageUrl})`
    : 'none'
  : 'none',
```

## Commit 2
- Hash: `24c9532`
- Message: `fix(panel): skip orphan links to avoid source/target undefined crash`

### Files touched
- `src/WeathermapPanel.tsx`
- `website/docs/faq.md`

### Blocks added (key excerpts)

```ts
// src/WeathermapPanel.tsx
function generateDrawnLink(d: Link, i: number): DrawnLink | null {
  const source = nodes.find((n) => n.id === toReturn.nodes[0].id);
  const target = nodes.find((n) => n.id === toReturn.nodes[1].id);
  if (!source || !target) {
    console.warn(`Network Weathermap: Skipping link "${toReturn.id}" because one or both nodes are missing.`);
    return null;
  }
  toReturn.source = source;
  toReturn.target = target;
  // ...
}
```

```ts
// src/WeathermapPanel.tsx
function buildDrawnLinks(sourceLinks: Link[]): DrawnLink[] {
  tempNodes = tempNodes.map((n) => {
    n.anchors = {
      0: { numLinks: n.anchors[0].numLinks, numFilledLinks: 0 },
      1: { numLinks: n.anchors[1].numLinks, numFilledLinks: 0 },
      2: { numLinks: n.anchors[2].numLinks, numFilledLinks: 0 },
      3: { numLinks: n.anchors[3].numLinks, numFilledLinks: 0 },
      4: { numLinks: n.anchors[4].numLinks, numFilledLinks: 0 },
    };
    return n;
  });

  return sourceLinks
    .map((d, i) => generateDrawnLink(d, i))
    .filter((link): link is DrawnLink => link !== null);
}
```

### Blocks removed/replaced (excerpts)

```ts
// Before (init links)
const [links, setLinks] = useState(
  wm
    ? wm.links.map((d, i) => {
        return generateDrawnLink(d, i);
      })
    : []
);

// After
const [links, setLinks] = useState(wm ? buildDrawnLinks(wm.links) : []);
```

```ts
// Before (FAQ)
- Just reload or force reload the page...

// After
- This error is now guarded in runtime by skipping orphaned links...
```

## Commit 3
- Hash: `f11abb7`
- Message: `chore(runtime): remove debug console output from panel code`

### Files touched
- `src/utils.ts`
- `src/forms/WeathermapBuilder.tsx`

### Blocks removed

```ts
// src/forms/WeathermapBuilder.tsx
console.log('Initializing weathermap plugin.');
```

```ts
// src/utils.ts
console.log(wm.scale);
console.log('updated weathermap state version', wm);
```

## Commit 4
- Hash: `843b0aa`
- Message: `chore(dev): default test stack to latest Grafana image`

### Files touched
- `docker-compose.yaml`
- `testing/README.md`

### Blocks changed

```yaml
# docker-compose.yaml
# Before
 grafana_version: ${GRAFANA_VERSION:-9.5.3}
# After
 grafana_version: ${GRAFANA_VERSION:-latest}
```

```md
# testing/README.md
# Before
The Grafana instance will be pointed to `localhost:3000`.

# After
The Grafana instance will be pointed to `localhost:3101`.
```

```md
# testing/README.md
# Before
* This currently builds using Grafana v8.1.8...

# After
* This testing stack now uses `grafana/grafana:latest` by default...
```

## Validations executed during Phase 0
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run test:ci` -> OK
- `npm run build` -> OK

## Cross-reference
- Phase 1 detailed diff log moved to `docs/03_phase1_detail_diff_changes.md`.
