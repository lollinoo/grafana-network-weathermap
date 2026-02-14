import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawnLink, DrawnNode } from 'types';
import { RenderLinkContext } from 'panel/renderLink';
import { LinkSegmentsLayer } from './LinkSegmentsLayer';

const createLink = (sourceId: string, targetId: string): DrawnLink =>
  ({
    nodes: [{ id: sourceId }, { id: targetId }],
    source: { x: 0, y: 0, index: 0 },
    target: { x: 10, y: 10, index: 1 },
    stroke: 2,
    sides: {
      A: { currentValue: 10, bandwidth: 100, dashboardLink: '/d/a' },
      Z: { currentValue: 20, bandwidth: 100, dashboardLink: '/d/z' },
    },
    lineStartA: { x: 1, y: 1 },
    lineEndA: { x: 2, y: 2 },
    lineStartZ: { x: 8, y: 8 },
    lineEndZ: { x: 9, y: 9 },
    arrowCenterA: { x: 3, y: 3 },
    arrowCenterZ: { x: 7, y: 7 },
    arrowPolygonA: { p1: { x: 1, y: 1 }, p2: { x: 2, y: 2 } },
    arrowPolygonZ: { p1: { x: 8, y: 8 }, p2: { x: 9, y: 9 } },
  } as unknown as DrawnLink);

const createNodes = (): DrawnNode[] => [{ isConnection: false }, { isConnection: false }] as unknown as DrawnNode[];

describe('LinkSegmentsLayer', () => {
  it('renders only non-self links', () => {
    const contexts: RenderLinkContext[] = [
      { link: createLink('a', 'b'), upstreamLinks: [] },
      { link: createLink('same', 'same'), upstreamLinks: [] },
    ];

    render(
      <svg>
        <LinkSegmentsLayer
          renderedLinkContexts={contexts}
          nodes={createNodes()}
          getScaleColor={() => '#cccccc'}
          onLinkHover={jest.fn()}
          onLinkHoverLoss={jest.fn()}
          onLinkClick={jest.fn()}
          isEditMode={true}
          selectionColor="#ff00aa"
        />
      </svg>
    );

    expect(screen.getAllByTestId('link')).toHaveLength(1);
  });

  it('invokes hover callbacks for link side A', () => {
    const hoverSpy = jest.fn();
    const hoverLossSpy = jest.fn();
    const contexts: RenderLinkContext[] = [{ link: createLink('a', 'b'), upstreamLinks: [] }];

    const { container } = render(
      <svg>
        <LinkSegmentsLayer
          renderedLinkContexts={contexts}
          nodes={createNodes()}
          getScaleColor={() => '#cccccc'}
          onLinkHover={hoverSpy}
          onLinkHoverLoss={hoverLossSpy}
          onLinkClick={jest.fn()}
          isEditMode={true}
          selectionColor="#ff00aa"
        />
      </svg>
    );

    const firstLine = container.querySelector('line');
    expect(firstLine).not.toBeNull();

    fireEvent.mouseMove(firstLine!);
    fireEvent.mouseOut(firstLine!);

    expect(hoverSpy).toHaveBeenCalled();
    expect(hoverLossSpy).toHaveBeenCalled();
  });
});
