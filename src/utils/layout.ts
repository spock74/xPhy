import dagre from 'dagre';
import { Node, Edge } from 'reactflow';
import { NODE_WIDTH } from '../constants';

// --- Dynamic Node Height Calculation ---
// These values are based on the styling in CustomNode.tsx and are approximations.
const CHARS_PER_LINE = 25; // Approximate characters per line for the given NODE_WIDTH.
const LINE_HEIGHT = 20; // Corresponds to Tailwind's `text-sm` line-height.
const BASE_NODE_HEIGHT = 40; // Base height for padding, border, and the type label line.

/**
 * Calculates the approximate height of a node based on its label length to accommodate text wrapping.
 * This is crucial for providing accurate dimensions to the Dagre layout engine to prevent overlaps.
 * @param label The text label of the node.
 * @returns The calculated height in pixels.
 */
const calculateNodeHeight = (label: string): number => {
  if (!label) {
    // Return a default height for nodes without labels.
    return BASE_NODE_HEIGHT + LINE_HEIGHT;
  }
  const numberOfLines = Math.ceil(label.length / CHARS_PER_LINE);
  return BASE_NODE_HEIGHT + numberOfLines * LINE_HEIGHT;
};


export const getLayoutedElements = (nodes: Node[], edges: Edge[], rankdir: string = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure the layout direction and spacing
  dagreGraph.setGraph({ rankdir, nodesep: 120, ranksep: 180 });

  const nodeDimensions = new Map<string, { width: number; height: number }>();

  nodes.forEach((node) => {
    const height = calculateNodeHeight(node.data.label);
    const width = NODE_WIDTH;
    nodeDimensions.set(node.id, { width, height });
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = nodeDimensions.get(node.id)!;

    // We need to center the node, as dagre's position refers to the top-left corner.
    node.position = {
      x: nodeWithPosition.x - width / 2,
      y: nodeWithPosition.y - height / 2,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};