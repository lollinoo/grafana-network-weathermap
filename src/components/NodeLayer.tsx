import React from 'react';
import { DrawnNode, Weathermap } from 'types';
import MapNode from './MapNode';

interface NodeLayerProps {
  nodes: DrawnNode[];
  draggedNode: DrawnNode;
  selectedNodes: DrawnNode[];
  selectedNodeId?: string;
  weathermap: Weathermap;
  isEditMode: boolean;
  data: any;
  onNodeDrag: (index: number, event: any, position: any) => void;
  onNodeStop: (index: number, event: any, position: any) => void;
  onNodeClick: (index: number, event: any) => void;
}

export const NodeLayer: React.FC<NodeLayerProps> = ({
  nodes,
  draggedNode,
  selectedNodes,
  selectedNodeId,
  weathermap,
  isEditMode,
  data,
  onNodeDrag,
  onNodeStop,
  onNodeClick,
}) => {
  return (
    <g>
      {nodes.map((d, i) => (
        <MapNode
          key={d.id}
          {...{
            node: d,
            draggedNode,
            selectedNodes,
            isEditorSelected: selectedNodeId === d.id,
            wm: weathermap,
            onDrag: (e, position) => {
              onNodeDrag(i, e, position);
            },
            onStop: (e, position) => {
              onNodeStop(i, e, position);
            },
            onClick: (e) => {
              onNodeClick(i, e);
            },
            disabled: !isEditMode,
            data,
          }}
        />
      ))}
    </g>
  );
};
