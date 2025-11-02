import { Node, Edge } from 'reactflow';

/**
 * Breaks cycles in a graph to ensure it's a Directed Acyclic Graph (DAG).
 * This function uses a Depth-First Search (DFS) traversal to find back edges.
 * Edges that form cycles (back edges) are marked for removal.
 *
 * @param nodes The array of nodes in the graph.
 * @param edges The array of edges in the graph.
 * @returns A new array of edges with cycles removed.
 */
export const breakCycles = (nodes: Node[], edges: Edge[]): Edge[] => {
  const adjMap: Map<string, string[]> = new Map();
  // Create a mutable copy of edges to mark for removal
  const edgesCopy = edges.map(edge => ({ ...edge, remove: false }));

  edgesCopy.forEach(edge => {
    if (!adjMap.has(edge.source)) {
      adjMap.set(edge.source, []);
    }
    adjMap.get(edge.source)!.push(edge.target);
  });

  const visitingSet = new Set<string>(); // Nodes currently in the recursion stack for the current DFS path
  const visitedSet = new Set<string>(); // All nodes that have been visited in any DFS traversal

  function dfs(nodeId: string) {
    visitingSet.add(nodeId);
    visitedSet.add(nodeId);

    const neighbors = adjMap.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (visitingSet.has(neighborId)) {
        // Cycle detected! This is a back edge. Mark it for removal.
        // Important: Only mark one instance of the edge if there are duplicates.
        const edgeToRemove = edgesCopy.find(e => !e.remove && e.source === nodeId && e.target === neighborId);
        if (edgeToRemove) {
          console.warn(`Cycle detected and broken: Edge from ${nodeId} to ${neighborId} removed.`);
          edgeToRemove.remove = true;
        }
      }
      if (!visitedSet.has(neighborId)) {
        dfs(neighborId);
      }
    }
    visitingSet.delete(nodeId);
  }

  // Iterate over all nodes to ensure all components of the graph are visited
  for (const node of nodes) {
    if (!visitedSet.has(node.id)) {
      dfs(node.id);
    }
  }

  return edgesCopy.filter(edge => !edge.remove);
};