import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DrawnNode, Weathermap } from 'types';
import { NodeLayer } from './NodeLayer';

jest.mock('./MapNode', () => {
  return function MockMapNode(props: any) {
    return (
      <button
        data-testid={`node-${props.node.id}`}
        onClick={(e) => props.onClick(e)}
        onMouseDown={(e) => props.onDrag(e, { deltaX: 1, deltaY: 2 })}
        onMouseUp={(e) => props.onStop(e, { deltaX: 1, deltaY: 2 })}
      >
        {props.node.id}
      </button>
    );
  };
});

const createNode = (id: string): DrawnNode => ({ id } as unknown as DrawnNode);

describe('NodeLayer', () => {
  it('maps nodes and routes click/drag/stop events with node index', () => {
    const onNodeClick = jest.fn();
    const onNodeDrag = jest.fn();
    const onNodeStop = jest.fn();

    render(
      <svg>
        <NodeLayer
          nodes={[createNode('n1'), createNode('n2')]}
          draggedNode={null as unknown as DrawnNode}
          selectedNodes={[]}
          weathermap={{} as Weathermap}
          isEditMode={true}
          data={{}}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeStop={onNodeStop}
        />
      </svg>
    );

    const nodeButton = screen.getByTestId('node-n2');
    fireEvent.mouseDown(nodeButton);
    fireEvent.mouseUp(nodeButton);
    fireEvent.click(nodeButton);

    expect(onNodeDrag).toHaveBeenCalledWith(1, expect.anything(), { deltaX: 1, deltaY: 2 });
    expect(onNodeStop).toHaveBeenCalledWith(1, expect.anything(), { deltaX: 1, deltaY: 2 });
    expect(onNodeClick).toHaveBeenCalledWith(1, expect.anything());
  });
});
