import { DrawnLink, DrawnNode } from 'types';

type WarnHandler = (message: string) => void;

function copyCalculatedSideValues(source: DrawnLink['sides']['A'], target: DrawnLink['sides']['A']): void {
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

function findForwardLinks(link: DrawnLink, allLinks: DrawnLink[], nodes: DrawnNode[]): DrawnLink[] {
  let forwardLinks = allLinks.filter((candidate) => candidate.source.id === link.target.id);

  while (forwardLinks.length === 1 && nodes[forwardLinks[0].target.index].isConnection) {
    forwardLinks = allLinks.filter((candidate) => candidate.source.id === forwardLinks[0].target.id);
  }

  return forwardLinks;
}

export function enrichHoveredLinkData(
  link: DrawnLink,
  allLinks: DrawnLink[],
  nodes: DrawnNode[],
  warn: WarnHandler = () => {}
): DrawnLink {
  const enrichedLink: DrawnLink = {
    ...link,
    sides: {
      A: { ...link.sides.A },
      Z: { ...link.sides.Z },
    },
  };

  if (nodes[link.source.index].isConnection) {
    const previousLinks = findUpstreamLinks(link, allLinks, nodes);

    if (previousLinks.length === 1) {
      copyCalculatedSideValues(previousLinks[0].sides.A, enrichedLink.sides.A);
    } else {
      warn(`Connection node "${link.source.label}" missing input connection.`);
    }
  }

  if (nodes[link.target.index].isConnection) {
    const forwardLinks = findForwardLinks(link, allLinks, nodes);

    if (forwardLinks.length === 1) {
      copyCalculatedSideValues(forwardLinks[0].sides.Z, enrichedLink.sides.Z);
    } else {
      warn(`Connection node "${link.target.label}" missing output connection.`);
    }
  }

  return enrichedLink;
}
