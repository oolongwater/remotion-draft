/**
 * TreeVisualizer.tsx
 * 
 * Mini tree preview component shown in top-right corner.
 * Displays current node, ancestors, and immediate children.
 * Click to open full TreeExplorer modal.
 */

import { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './TreeAnimations.css';
import { LearningTree } from '../types/VideoConfig';
import {
  getCurrentNode,
  getChildren,
  getNodeNumber,
  getPathFromRoot,
} from '../types/TreeState';

interface TreeVisualizerProps {
  tree: LearningTree;
  onExpandClick: () => void;
  className?: string;
}

/**
 * Custom node component that shows label on hover
 */
const TreeNode = ({ data }: NodeProps) => {
  const [showLabel, setShowLabel] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const hasThumbnail = data.thumbnailUrl && !imageError;
  
  return (
    <div 
      className="relative w-full h-full flex items-center justify-center"
      onMouseEnter={() => setShowLabel(true)}
      onMouseLeave={() => setShowLabel(false)}
    >
      {/* Connection handles - invisible but necessary for edges */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      
      {/* Show tiny thumbnail if available */}
      {hasThumbnail && (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <img 
            src={data.thumbnailUrl} 
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      
      {/* Label tooltip on hover */}
      {showLabel && (data.nodeNumber || data.title) && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none shadow-lg border border-slate-700 max-w-[200px]">
          <div className="font-semibold">{data.nodeNumber}</div>
          {data.title && <div className="text-[10px] text-slate-300 mt-0.5 truncate">{data.title}</div>}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  treeNode: TreeNode,
};

/**
 * Mini tree preview - compact visualization
 */
export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  tree,
  onExpandClick,
  className = '',
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  // Build mini tree visualization - compact git-like history view
  useEffect(() => {
    const currentNode = getCurrentNode(tree);
    if (!currentNode) {
      setNodes([]);
      setEdges([]);
      return;
    }
    
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    const nodeSpacing = 35; // Horizontal spacing between nodes
    const nodeSize = 16;
    const currentNodeSize = 20;
    const branchYOffset = 20; // Y offset for branches
    
    // Color palette
    const nodeColors = ['#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#ef4444'];
    
    // Build the tree level by level, showing all branches
    const nodeLevels: TreeNode[][] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();
    const nodeColumns = new Map<string, number>(); // Track which column each node is in
    
    // BFS to get all nodes level by level, starting from all roots
    const queue: { node: TreeNode; level: number; column: number }[] = [];
    if (tree.rootIds && tree.rootIds.length > 0) {
      // Add all roots to queue
      tree.rootIds.forEach((rootId, rootIndex) => {
        const root = tree.nodes.get(rootId);
        if (root) {
          queue.push({ node: root, level: 0, column: rootIndex * 2 }); // Spread roots horizontally
        }
      });
      
      while (queue.length > 0) {
        const { node, level, column } = queue.shift()!;
        
        if (!nodeLevels[level]) nodeLevels[level] = [];
        nodeLevels[level].push(node);
        nodeColumns.set(node.id, column);
        
        // Add children
        const children = getChildren(tree, node.id);
        children.forEach((child, idx) => {
          queue.push({ 
            node: child, 
            level: level + 1, 
            column: column + idx // Each child gets offset column
          });
        });
      }
    }
    
    // Find the window of levels to display (centered around current node)
    const currentPath = getPathFromRoot(tree, currentNode.id);
    const currentLevel = currentPath.length - 1;
    const startLevel = Math.max(0, currentLevel - 4);
    const endLevel = Math.min(nodeLevels.length - 1, currentLevel + 5);
    
    // Calculate center position - where the current node should be
    // We want it centered in the viewport
    const centerX = 0; // This will be the "center" - React Flow will center on current node
    
    // Center Y position for horizontal layout (middle of container height)
    const centerY = 70;
    
    // Position nodes relative to current node being at centerX
    for (let level = startLevel; level <= endLevel; level++) {
      const nodesAtLevel = nodeLevels[level] || [];
      
      // Calculate X position relative to current node being centered (horizontal now)
      const xPosition = (level - currentLevel) * nodeSpacing;
      
      // If multiple nodes at this level, offset them vertically
      const totalNodesAtLevel = nodesAtLevel.length;
      
      nodesAtLevel.forEach((node, indexAtLevel) => {
        const isCurrent = node.id === currentNode.id;
        const isOnCurrentPath = currentPath.some(n => n.id === node.id);
        const nodeNumber = getNodeNumber(tree, node.id);
        const size = isCurrent ? currentNodeSize : nodeSize;
        const isQuestionNode = node.segment.isQuestionNode || false;
        
        // Calculate Y position - center the main path, offset branches vertically
        let yPos = centerY;
        if (totalNodesAtLevel > 1) {
          // Multiple nodes at this level - spread them out vertically
          const offset = (indexAtLevel - (totalNodesAtLevel - 1) / 2) * branchYOffset;
          yPos = centerY + offset;
        }
        
        // Color logic: Question nodes are always yellow, current nodes are blue, others use branch colors
        const colorIndex = node.branchIndex % nodeColors.length;
        let nodeColor = nodeColors[colorIndex];
        if (isQuestionNode) {
          nodeColor = '#fbbf24'; // Yellow for question nodes (always)
        } else if (isCurrent) {
          nodeColor = '#3b82f6'; // Blue for current video nodes
        }
        
        nodePositions.set(node.id, { x: xPosition, y: yPos });
        
        newNodes.push({
          id: node.id,
          type: 'treeNode',
          data: { 
            label: '',
            nodeNumber: nodeNumber,
            title: node.segment.title,
            thumbnailUrl: node.segment.thumbnailUrl,
          },
          position: { x: xPosition, y: yPos },
          style: {
            background: nodeColor,
            border: isQuestionNode 
              ? '3px solid #f59e0b' 
              : (isCurrent ? '2px solid #60a5fa' : 'none'),
            borderRadius: '50%',
            width: size,
            height: size,
            boxShadow: isQuestionNode 
              ? '0 0 30px rgba(251, 191, 36, 0.8)' 
              : (isCurrent ? '0 0 12px rgba(59, 130, 246, 0.6)' : 'none'),
            cursor: 'pointer',
            opacity: isOnCurrentPath || isCurrent || isQuestionNode ? 1 : 0.7,
          },
          draggable: false,
        });
        
        // Add edge from parent with visible styling
        if (node.parentId && nodePositions.has(node.parentId)) {
          const parentPos = nodePositions.get(node.parentId)!;
          const colorIndex = node.branchIndex % nodeColors.length;
          const edgeColor = isOnCurrentPath ? nodeColors[colorIndex] : '#475569';
          
          newEdges.push({
            id: `e-${node.parentId}-${node.id}`,
            source: node.parentId,
            target: node.id,
            type: 'default',
            style: { 
              stroke: edgeColor, 
              strokeWidth: isOnCurrentPath ? 2 : 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
              width: 10,
              height: 10,
            },
          });
        }
      });
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, tree.currentNodeId, setNodes, setEdges]);
  
  const handleNodeClick = useCallback(() => {
    onExpandClick();
  }, [onExpandClick]);
  
  if (tree.nodes.size === 0) {
    return null;
  }
  
  return (
    <div
      className={`bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden hover:bg-slate-800/90 transition-colors glow-border relative ${className}`}
      style={{ height: '140px', width: '100%', maxWidth: '100%' }}
    >
      {/* History tag in top-left */}
      <div className="absolute top-2 left-2 bg-slate-700/80 rounded px-2 py-1 text-xs text-slate-400 font-medium z-10 pointer-events-none">
        History
      </div>
      
      {/* Tree visualization */}
      <div 
        className="w-full h-full cursor-pointer relative"
        onClick={handleNodeClick}
      >
        <style>{`
          .react-flow__minimap,
          .react-flow__controls,
          .react-flow__attribution,
          .react-flow__panel {
            display: none !important;
          }
        `}</style>
        <ReactFlow
          key={tree.currentNodeId} // Force re-center when node changes
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          preventScrolling={true}
          fitView
          fitViewOptions={{ 
            padding: 0.3,
            includeHiddenNodes: false,
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#475569" gap={16} />
        </ReactFlow>
        
        {/* Expand hint overlay */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-slate-700/80 rounded px-2 py-1 text-xs text-slate-300 whitespace-nowrap pointer-events-none">
          Click to expand
        </div>
      </div>
    </div>
  );
};

