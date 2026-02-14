import { DrawnLink, DrawnNode } from 'types';

type WarnHandler = (message: string) => void;

export interface RenderLinkContext {
  link: DrawnLink;
  upstreamLinks: DrawnLink[];
}

function copyCalculatedSideAValues(source: DrawnLink['sides']['A'], target: DrawnLink['sides']['A']): void {
  target.bandwidth = source.bandwidth;
  target.bandwidthQuery = source.bandwidthQuery;
  target.query = source.query;
  target.dashboardLink = source.dashboardLink;
  target.currentValue = source.currentValue;
  target.currentText = source.currentText;
  target.currentBandwidthText = source.currentBandwidthText;
  target.currentValueText = source.currentValueText;
  target.currentPercentageText = source.currentPercentageText;
}

function findUpstreamLinks(link: DrawnLink, allLinks: DrawnLink[], nodes: DrawnNode[]): DrawnLink[] {
  let previousLinks = allLinks.filter((candidate) => candidate.target.id === link.source.id);

  while (previousLinks.length === 1 && nodes[previousLinks[0].source.index].isConnection) {
    previousLinks = allLinks.filter((candidate) => candidate.target.id === previousLinks[0].source.id);
  }

  return previousLinks;
}

export function buildRenderLinkContext(
  link: DrawnLink,
  allLinks: DrawnLink[],
  nodes: DrawnNode[],
  warn: WarnHandler = () => {}
): RenderLinkContext {
  const renderedLink: DrawnLink = {
    ...link,
    sides: {
      A: { ...link.sides.A },
      Z: { ...link.sides.Z },
    },
  };

  if (!nodes[link.source.index].isConnection) {
    return { link: renderedLink, upstreamLinks: [] };
  }

  const upstreamLinks = findUpstreamLinks(link, allLinks, nodes);
  if (upstreamLinks.length === 1) {
    copyCalculatedSideAValues(upstreamLinks[0].sides.A, renderedLink.sides.A);
  } else {
    warn(`Connection node "${link.source.label}" missing input connection.`);
  }

  return { link: renderedLink, upstreamLinks };
}
