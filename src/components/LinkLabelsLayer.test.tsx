import React from 'react';
import { render, screen } from '@testing-library/react';
import { DrawnLink, DrawnNode } from 'types';
import { RenderLinkContext } from 'panel/renderLink';
import { LinkLabelsLayer } from './LinkLabelsLayer';

const createLink = (sourceId: string, targetId: string, targetIndex = 1): DrawnLink =>
  ({
    nodes: [{ id: sourceId }, { id: targetId }],
    target: { index: targetIndex },
    lineStartA: { x: 10, y: 20 },
    lineStartZ: { x: 30, y: 40 },
    sides: {
      A: { currentText: 'A current', labelOffset: 50 },
      Z: { currentText: 'Z current', labelOffset: 40 },
    },
  } as unknown as DrawnLink);

const createNodes = (targetIsConnection = false): DrawnNode[] =>
  [{ isConnection: false }, { isConnection: targetIsConnection }] as unknown as DrawnNode[];

describe('LinkLabelsLayer', () => {
  it('renders labels for side A', () => {
    const contexts: RenderLinkContext[] = [{ link: createLink('a', 'b'), upstreamLinks: [] }];

    render(
      <svg>
        <LinkLabelsLayer
          renderedLinkContexts={contexts}
          nodes={createNodes(false)}
          side="A"
          fontSize={12}
          backgroundColor="#000000"
          borderColor="#ffffff"
          fontColor="#cccccc"
          panelBackgroundColor="#111111"
          onLinkHover={jest.fn()}
          onLinkHoverLoss={jest.fn()}
          onLinkClick={jest.fn()}
          isEditMode={true}
        />
      </svg>
    );

    expect(screen.getByText('A current')).toBeInTheDocument();
  });

  it('does not render side Z labels when the target node is a connection', () => {
    const contexts: RenderLinkContext[] = [{ link: createLink('a', 'b'), upstreamLinks: [] }];

    render(
      <svg>
        <LinkLabelsLayer
          renderedLinkContexts={contexts}
          nodes={createNodes(true)}
          side="Z"
          fontSize={12}
          backgroundColor="#000000"
          borderColor="#ffffff"
          fontColor="#cccccc"
          panelBackgroundColor="#111111"
          onLinkHover={jest.fn()}
          onLinkHoverLoss={jest.fn()}
          onLinkClick={jest.fn()}
          isEditMode={true}
        />
      </svg>
    );

    expect(screen.queryByText('Z current')).not.toBeInTheDocument();
  });
});
