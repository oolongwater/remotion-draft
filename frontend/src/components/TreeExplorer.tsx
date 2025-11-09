/**
 * TreeExplorer.tsx
 *
 * Full-screen modal for exploring the entire learning tree.
 * Features zoom, pan, drag, and node clicking for navigation.
 */

import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeMouseHandler,
  NodeProps,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useState } from "react";
import {
  getAllNodes,
  getCurrentNode,
  getNodeNumber,
  getPathFromRoot,
} from "../types/TreeState";
import { LearningTree } from "../types/VideoConfig";
import "./TreeAnimations.css";

interface TreeExplorerProps {
  tree: LearningTree;
  onNodeClick: (nodeId: string) => void;
  onClose: () => void;
}

/**
 * Custom node component for tree explorer with thumbnail and title
 */
const ExplorerNode = ({ data }: NodeProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Show thumbnail if available, otherwise show colored circle
  const hasThumbnail = (data as any).thumbnailUrl && !imageError;

  return (
    <div
      className="relative flex flex-col items-center gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {/* Node display - either thumbnail or circle */}
      <div className="relative">
        {/* Yellow ring for question nodes - unclickable and always visible */}
        {(data as any).isQuestionNode && (
          <div 
            className="absolute pointer-events-none rounded-lg"
            style={{
              inset: '-8px',
              border: '4px solid #fbbf24',
              boxShadow: '0 0 25px rgba(251, 191, 36, 0.95), inset 0 0 15px rgba(251, 191, 36, 0.3)',
              borderRadius: hasThumbnail ? '12px' : '50%',
              zIndex: 10,
            }}
          />
        )}
        
        {hasThumbnail ? (
          // Thumbnail image with node number overlay
          <div
            className="relative w-32 h-20 rounded-lg overflow-hidden shadow-lg"
            style={{
              border: (data as any).isQuestionNode
                ? '3px solid #f59e0b'
                : ((data as any).isCurrent
                  ? "3px solid #60a5fa"
                  : `2px solid ${(data as any).borderColor || "#3b82f6"}`),
              boxShadow: (data as any).isQuestionNode
                ? '0 0 30px rgba(251, 191, 36, 0.8), 0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                : ((data as any).isCurrent
                  ? "0 0 30px rgba(59, 130, 246, 0.8), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                  : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"),
            }}
          >
            <img
              src={(data as any).thumbnailUrl}
              alt={
                (data as any).title ||
                (data as any).topic ||
                "Section thumbnail"
              }
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            {/* Node number badge on thumbnail */}
            <div
              className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
              style={{ backgroundColor: (data as any).nodeColor || "#3b82f6" }}
            >
              {(data as any).nodeNumber}
            </div>
          </div>
        ) : (
          // Fallback to circle with number
          <div className="w-10 h-10 flex items-center justify-center font-bold text-xs">
            {(data as any).nodeNumber}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Title label below node - centered with text wrapping */}
      {((data as any).title || (data as any).topic) && (
        <div className="max-w-[160px] text-center pointer-events-none">
          <div className="text-xs text-white font-semibold bg-slate-900/80 px-2 py-1 rounded break-words">
            {(data as any).title || (data as any).topic}
          </div>
        </div>
      )}

      {/* Extended tooltip on hover with more details */}
      {showTooltip && (
        <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-slate-800 text-white text-sm px-3 py-2 rounded-lg z-50 pointer-events-none shadow-xl border border-slate-600 max-w-xs">
          <div className="font-semibold text-blue-400">
            {(data as any).nodeNumber}
          </div>
          {(data as any).title && (
            <div className="text-sm font-medium mt-1">
              {(data as any).title}
            </div>
          )}
          {(data as any).topic &&
            (data as any).topic !== (data as any).title && (
              <div className="text-xs text-slate-300 mt-1">
                {(data as any).topic}
              </div>
            )}
          {(data as any).voiceoverScript && (
            <div className="text-xs text-slate-400 mt-2 max-h-20 overflow-y-auto">
              {(data as any).voiceoverScript?.substring(0, 150)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  explorerNode: ExplorerNode,
};

/**
 * Calculate bounding box for a set of positioned nodes
 */
function calculateTreeBounds(
  positions: Map<string, { x: number; y: number }>,
  nodeIds: string[]
): { minX: number; maxX: number; minY: number; maxY: number } {
  if (nodeIds.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  for (const nodeId of nodeIds) {
    const pos = positions.get(nodeId);
    if (pos) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }
  }
  
  return { minX, maxX, minY, maxY };
}

/**
 * Get all node IDs belonging to a specific root tree
 */
function getNodesInTree(tree: LearningTree, rootId: string): string[] {
  const nodeIds: string[] = [];
  
  function traverse(nodeId: string) {
    nodeIds.push(nodeId);
    const node = tree.nodes.get(nodeId);
    if (node && node.childIds.length > 0) {
      node.childIds.forEach(childId => traverse(childId));
    }
  }
  
  traverse(rootId);
  return nodeIds;
}

/**
 * Calculate hierarchical layout positions for multi-root trees
 * HORIZONTAL LAYOUT: left to right with vertical branching
 * Uses collision-aware positioning to place roots dynamically
 */
function calculateTreeLayout(tree: LearningTree) {
  const positions = new Map<string, { x: number; y: number }>();
  const verticalSpacing = 200; // Spacing between siblings (vertical branching)
  const horizontalSpacing = 280; // Space between levels (horizontal progression)
  const treeClearance = 400; // Minimum clearance between separate root trees (horizontal)
  
  // Traverse a single tree with HORIZONTAL layout (left to right)
  function traverseTree(
    rootId: string, 
    offsetX: number, 
    offsetY: number,
    targetMap: Map<string, { x: number; y: number }>
  ) {
    const levelWidth = new Map<number, number>();
    
    function traverse(nodeId: string, level: number, parentY: number, childIndex: number, totalSiblings: number) {
      const currentWidth = levelWidth.get(level) || 0;
      levelWidth.set(level, currentWidth + 1);
      
      // HORIZONTAL LAYOUT: x is level (left to right), y is branching (vertical)
      const localOffsetY = (childIndex - (totalSiblings - 1) / 2) * verticalSpacing + parentY;
      
      targetMap.set(nodeId, {
        x: level * horizontalSpacing + offsetX, // X is the level (horizontal progression)
        y: localOffsetY + offsetY, // Y is the offset (vertical branching)
      });
      
      const node = tree.nodes.get(nodeId);
      if (node && node.childIds.length > 0) {
        node.childIds.forEach((childId, index) => {
          traverse(childId, level + 1, localOffsetY, index, node.childIds.length);
        });
      }
    }
    
    traverse(rootId, 0, 0, 0, 1);
  }
  
  // Get root IDs from the tree
  const rootIds = tree.rootIds || [];
  if (rootIds.length === 0) return positions;
  
  // First root at origin
  traverseTree(rootIds[0], 0, 0, positions);
  
  // Position remaining roots with collision avoidance (vertically stacked)
  for (let i = 1; i < rootIds.length; i++) {
    const rootId = rootIds[i];
    
    // Layout tree temporarily at origin to calculate its bounds
    const tempPositions = new Map<string, { x: number; y: number }>();
    traverseTree(rootId, 0, 0, tempPositions);
    const treeNodes = getNodesInTree(tree, rootId);
    const treeBounds = calculateTreeBounds(tempPositions, treeNodes);
    
    // Find safe position below all existing trees
    let safeY = 0;
    const existingNodeIds = Array.from(positions.keys());
    if (existingNodeIds.length > 0) {
      const existingBounds = calculateTreeBounds(positions, existingNodeIds);
      safeY = existingBounds.maxY + treeClearance + Math.abs(treeBounds.minY);
    }
    
    // Layout this tree at the safe position
    traverseTree(rootId, 0, safeY, positions);
  }

  return positions;
}

/**
 * Full-screen tree explorer modal
 */
export const TreeExplorer: React.FC<TreeExplorerProps> = ({
  tree,
  onNodeClick,
  onClose,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Build full tree visualization
  useEffect(() => {
    const allNodes = getAllNodes(tree);
    const currentNode = getCurrentNode(tree);
    const positions = calculateTreeLayout(tree);

    // Color palette matching the mini view
    const nodeColors = [
      "#3b82f6",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
      "#10b981",
      "#ef4444",
    ];

    const newNodes: Node[] = allNodes.map((treeNode) => {
      const isCurrent = treeNode.id === currentNode?.id;
      const nodeNumber = getNodeNumber(tree, treeNode.id);
      const position = positions.get(treeNode.id) || { x: 0, y: 0 };
      const isOnCurrentPath = currentNode
        ? getPathFromRoot(tree, currentNode.id).some(
            (n) => n.id === treeNode.id
          )
        : false;

      // Check if this is a question node
      const isQuestionNode = treeNode.segment.isQuestionNode || false;
      
      // Color logic: Question nodes are always yellow, current nodes are blue, others use branch colors
      const colorIndex = treeNode.branchIndex % nodeColors.length;
      let nodeColor = nodeColors[colorIndex];
      if (isQuestionNode) {
        nodeColor = '#fbbf24'; // Yellow for question nodes (always)
      } else if (isCurrent) {
        nodeColor = '#3b82f6'; // Blue for current video nodes
      }

      // Determine if this node has a thumbnail
      const hasThumbnail = !!(treeNode.segment as any).thumbnailUrl;

      return {
        id: treeNode.id,
        type: "explorerNode",
        data: {
          nodeNumber: nodeNumber,
          topic: treeNode.segment.topic,
          title: (treeNode.segment as any).title,
          thumbnailUrl: (treeNode.segment as any).thumbnailUrl,
          voiceoverScript: treeNode.segment.voiceoverScript,
          nodeColor: nodeColor,
          borderColor: isQuestionNode 
            ? '#f59e0b' 
            : (isCurrent ? '#60a5fa' : nodeColor),
          isCurrent: isCurrent,
          isQuestionNode: isQuestionNode,
        },
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: hasThumbnail ? "transparent" : nodeColor,
          color: "#fff",
          border: isQuestionNode && !hasThumbnail
            ? '3px solid #f59e0b'
            : (isCurrent && !hasThumbnail ? "3px solid #60a5fa" : "none"),
          borderRadius: hasThumbnail ? "0" : "50%",
          padding: "0",
          width: hasThumbnail ? "auto" : "40px",
          height: hasThumbnail ? "auto" : "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isQuestionNode && !hasThumbnail
            ? '0 0 30px rgba(251, 191, 36, 0.8)'
            : (isCurrent && !hasThumbnail
              ? "0 0 30px rgba(59, 130, 246, 0.8)"
              : !hasThumbnail
              ? "0 2px 8px rgba(0, 0, 0, 0.3)"
              : "none"),
          cursor: "pointer",
          transition: "all 0.2s ease",
          opacity: isOnCurrentPath || isCurrent || isQuestionNode ? 1 : 0.7,
        },
        draggable: true,
      };
    });

    const newEdges: Edge[] = [];

    allNodes.forEach((treeNode) => {
      if (treeNode.childIds && treeNode.childIds.length > 0) {
        console.log(
          `Node ${treeNode.id} has ${treeNode.childIds.length} children:`,
          treeNode.childIds
        );

        treeNode.childIds.forEach((childId) => {
          const child = tree.nodes.get(childId);
          if (!child) {
            console.warn(`Child ${childId} not found in tree!`);
            return;
          }

          // Color based on child's branch
          const colorIndex = (child.branchIndex || 0) % nodeColors.length;
          const edgeColor = nodeColors[colorIndex];

          console.log(
            `Creating edge from ${treeNode.id} to ${childId}, color: ${edgeColor}`
          );

          newEdges.push({
            id: `edge-${treeNode.id}-to-${childId}`,
            source: treeNode.id,
            target: childId,
            type: "smoothstep",
            animated: false,
            style: {
              stroke: edgeColor,
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
              color: edgeColor,
            },
          });
        });
      }
    });

    console.log(
      "TreeExplorer - Total Nodes:",
      newNodes.length,
      "Total Edges:",
      newEdges.length
    );
    if (newEdges.length > 0) {
      console.log("Sample edges:", newEdges.slice(0, 3));
    }
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, tree.currentNodeId, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleBackgroundClick = useCallback(() => {
    // Don't close on background click - only via close button
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm modal-fade">
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handleBackgroundClick}
          fitView
          fitViewOptions={{ padding: 0.15, minZoom: 0.5, maxZoom: 1.5 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls
            style={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
            }}
          />

          {/* Header panel with title and close button */}
          <Panel position="top-center">
            <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg px-6 py-3 shadow-xl">
              <div className="flex items-center gap-4">
                <h2 className="text-white text-lg font-semibold">
                  Learning Path Explorer
                </h2>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Close (ESC)
                </button>
              </div>
            </div>
          </Panel>

          {/* Legend panel */}
          <Panel position="bottom-left">
            <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3 text-sm">
              <div className="flex flex-col gap-2 text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500 border-2 border-blue-400"></div>
                  <span>Current Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-600 border-2 border-slate-500"></div>
                  <span>Visited Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-700 border-2 border-dashed border-slate-500"></div>
                  <span>Leaf Node</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};
