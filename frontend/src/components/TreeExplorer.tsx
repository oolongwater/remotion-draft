/**
 * TreeExplorer.tsx
 * 
 * Full-screen modal for exploring the entire learning tree.
 * Features zoom, pan, drag, and node clicking for navigation.
 */

import { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeMouseHandler,
  Panel,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './TreeAnimations.css';
import { LearningTree } from '../types/VideoConfig';
import {
  getAllNodes,
  getNodeNumber,
  getCurrentNode,
  getPathFromRoot,
} from '../types/TreeState';

interface TreeExplorerProps {
  tree: LearningTree;
  onNodeClick: (nodeId: string) => void;
  onClose: () => void;
}

/**
 * Custom node component for tree explorer with visible label
 */
const ExplorerNode = ({ data }: NodeProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      
      {/* Node circle with number */}
      <div className="w-full h-full flex items-center justify-center font-bold text-xs">
        {data.nodeNumber}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      
      {/* Topic label below node */}
      {data.topic && (
        <div className="absolute top-full mt-2 text-sm text-white font-medium max-w-[160px] text-center pointer-events-none bg-slate-900/80 px-2 py-1 rounded">
          {data.topic}
        </div>
      )}
      
      {/* Extended tooltip on hover */}
      {showTooltip && data.topic && (
        <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-slate-800 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl border border-slate-600">
          <div className="font-semibold">{data.nodeNumber}</div>
          <div className="text-xs text-slate-300 mt-1">{data.topic}</div>
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
 * Uses collision-aware positioning to place roots dynamically
 */
function calculateTreeLayout(tree: LearningTree) {
  const positions = new Map<string, { x: number; y: number }>();
  const horizontalSpacing = 400; // Spacing between siblings
  const verticalSpacing = 250; // Spacing between levels
  const treeClearance = 400; // Minimum clearance between separate root trees
  
  // Traverse a single tree and return positions
  function traverseTree(
    rootId: string, 
    offsetX: number, 
    offsetY: number,
    targetMap: Map<string, { x: number; y: number }>
  ) {
    const levelWidth = new Map<number, number>();
    
    function traverse(nodeId: string, level: number, parentX: number, childIndex: number, totalSiblings: number) {
      const currentWidth = levelWidth.get(level) || 0;
      levelWidth.set(level, currentWidth + 1);
      
      const localOffsetX = (childIndex - (totalSiblings - 1) / 2) * horizontalSpacing + parentX;
      
      targetMap.set(nodeId, {
        x: localOffsetX + offsetX,
        y: level * verticalSpacing + offsetY,
      });
      
      const node = tree.nodes.get(nodeId);
      if (node && node.childIds.length > 0) {
        node.childIds.forEach((childId, index) => {
          traverse(childId, level + 1, localOffsetX, index, node.childIds.length);
        });
      }
    }
    
    traverse(rootId, 0, 0, 0, 1);
  }
  
  // Position each root tree
  if (!tree.rootIds || tree.rootIds.length === 0) return positions;
  
  // First root at origin
  traverseTree(tree.rootIds[0], 0, 0, positions);
  
  // Position remaining roots with collision avoidance
  for (let i = 1; i < tree.rootIds.length; i++) {
    const rootId = tree.rootIds[i];
    
    // Layout tree temporarily at origin to calculate its bounds
    const tempPositions = new Map<string, { x: number; y: number }>();
    traverseTree(rootId, 0, 0, tempPositions);
    const treeNodes = getNodesInTree(tree, rootId);
    const treeBounds = calculateTreeBounds(tempPositions, treeNodes);
    
    // Find safe position to the right of all existing trees
    let safeX = 0;
    const existingNodeIds = Array.from(positions.keys());
    if (existingNodeIds.length > 0) {
      const existingBounds = calculateTreeBounds(positions, existingNodeIds);
      safeX = existingBounds.maxX + treeClearance + Math.abs(treeBounds.minX);
    }
    
    // Layout this tree at the safe position (now writing to positions)
    traverseTree(rootId, safeX, 0, positions);
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
    const nodeColors = ['#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#ef4444'];
    
    const newNodes: Node[] = allNodes.map((treeNode) => {
      const isCurrent = treeNode.id === currentNode?.id;
      const nodeNumber = getNodeNumber(tree, treeNode.id);
      const position = positions.get(treeNode.id) || { x: 0, y: 0 };
      const isOnCurrentPath = currentNode ? 
        getPathFromRoot(tree, currentNode.id).some(n => n.id === treeNode.id) : false;
      
      // Color based on branch
      const colorIndex = treeNode.branchIndex % nodeColors.length;
      const nodeColor = isCurrent ? '#3b82f6' : nodeColors[colorIndex];
      
      return {
        id: treeNode.id,
        type: 'explorerNode',
        data: {
          nodeNumber: nodeNumber,
          topic: treeNode.segment.topic,
        },
        position,
        sourcePosition: 'bottom' as const,
        targetPosition: 'top' as const,
        style: {
          background: nodeColor,
          color: '#fff',
          border: isCurrent ? '3px solid #60a5fa' : 'none',
          borderRadius: '50%',
          padding: '0',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isCurrent
            ? '0 0 30px rgba(59, 130, 246, 0.8)'
            : '0 2px 8px rgba(0, 0, 0, 0.3)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          opacity: isOnCurrentPath || isCurrent ? 1 : 0.7,
        },
        draggable: true,
      };
    });
    
    const newEdges: Edge[] = [];
    
    allNodes.forEach((treeNode) => {
      if (treeNode.childIds && treeNode.childIds.length > 0) {
        console.log(`Node ${treeNode.id} has ${treeNode.childIds.length} children:`, treeNode.childIds);
        
        treeNode.childIds.forEach((childId) => {
          const child = tree.nodes.get(childId);
          if (!child) {
            console.warn(`Child ${childId} not found in tree!`);
            return;
          }
          
          const edgeLabel = child.branchLabel || '';
          
          // Color based on child's branch
          const colorIndex = (child.branchIndex || 0) % nodeColors.length;
          const edgeColor = nodeColors[colorIndex];
          
          console.log(`Creating edge from ${treeNode.id} to ${childId}, color: ${edgeColor}`);
          
          newEdges.push({
            id: `edge-${treeNode.id}-to-${childId}`,
            source: treeNode.id,
            target: childId,
            type: 'smoothstep',
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
    
    console.log('TreeExplorer - Total Nodes:', newNodes.length, 'Total Edges:', newEdges.length);
    if (newEdges.length > 0) {
      console.log('Sample edges:', newEdges.slice(0, 3));
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
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
          />
          <MiniMap
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            nodeColor={(node) => {
              const isCurrent = node.id === tree.currentNodeId;
              return isCurrent ? '#3b82f6' : '#64748b';
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

