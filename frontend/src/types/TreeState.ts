/**
 * TreeState.ts
 * 
 * Utility functions for managing the learning tree structure.
 * Provides tree traversal, manipulation, and localStorage persistence.
 */

import {
  TreeNode,
  LearningTree,
  VideoSegment,
  LegacyVideoSession,
  generateNodeId,
} from './VideoConfig';

/**
 * Serializable tree format for localStorage
 */
export interface SerializedTree {
  nodes: Array<{
    id: string;
    segment: VideoSegment;
    parentId: string | null;
    childIds: string[];
    branchIndex: number;
    branchLabel?: string;
  }>;
  rootId: string;
  currentNodeId: string;
}

/**
 * Get a node from the tree by ID
 * O(1) lookup
 */
export function getNode(tree: LearningTree, id: string): TreeNode | null {
  return tree.nodes.get(id) || null;
}

/**
 * Get all child nodes of a given node
 */
export function getChildren(tree: LearningTree, nodeId: string): TreeNode[] {
  const node = getNode(tree, nodeId);
  if (!node) return [];
  
  return node.childIds
    .map(childId => getNode(tree, childId))
    .filter((node): node is TreeNode => node !== null);
}

/**
 * Get the parent node of a given node
 */
export function getParent(tree: LearningTree, nodeId: string): TreeNode | null {
  const node = getNode(tree, nodeId);
  if (!node || !node.parentId) return null;
  
  return getNode(tree, node.parentId);
}

/**
 * Calculate hierarchical node number (e.g., "1", "1.1", "1.2.3")
 * Walks up the parent chain and builds the number
 */
export function getNodeNumber(tree: LearningTree, nodeId: string): string {
  const node = getNode(tree, nodeId);
  if (!node) return '';
  
  // Build path from root to this node
  const path: number[] = [];
  let currentNode: TreeNode | null = node;
  
  while (currentNode) {
    path.unshift(currentNode.branchIndex + 1); // +1 because branchIndex is 0-based
    if (currentNode.parentId === null) break;
    currentNode = getParent(tree, currentNode.id);
  }
  
  return path.join('.');
}

/**
 * Get the path from root to a specific node
 * Returns array of nodes in order from root to target
 */
export function getPathFromRoot(tree: LearningTree, nodeId: string): TreeNode[] {
  const path: TreeNode[] = [];
  let currentNode = getNode(tree, nodeId);
  
  while (currentNode) {
    path.unshift(currentNode);
    if (currentNode.parentId === null) break;
    currentNode = getParent(tree, currentNode.id);
  }
  
  return path;
}

/**
 * Get all nodes in the tree as a flat array
 */
export function getAllNodes(tree: LearningTree): TreeNode[] {
  return Array.from(tree.nodes.values());
}

/**
 * Add a child node to a parent node
 * Returns the newly created node
 */
export function addChildNode(
  tree: LearningTree,
  parentId: string,
  segment: VideoSegment,
  branchLabel?: string
): TreeNode {
  const parent = getNode(tree, parentId);
  if (!parent) {
    throw new Error(`Parent node ${parentId} not found`);
  }
  
  // Create new node
  const newNode: TreeNode = {
    id: generateNodeId(),
    segment,
    parentId,
    childIds: [],
    branchIndex: parent.childIds.length, // Index in parent's children array
    branchLabel,
  };
  
  // Add to tree
  tree.nodes.set(newNode.id, newNode);
  
  // Update parent's childIds
  parent.childIds.push(newNode.id);
  
  return newNode;
}

/**
 * Create a root node for a new tree
 * Used when starting a new learning session
 */
export function createRootNode(segment: VideoSegment): TreeNode {
  return {
    id: generateNodeId(),
    segment,
    parentId: null,
    childIds: [],
    branchIndex: 0,
    branchLabel: undefined,
  };
}

/**
 * Initialize a new tree with a root node
 */
export function initializeTree(segment: VideoSegment): LearningTree {
  const rootNode = createRootNode(segment);
  const tree: LearningTree = {
    nodes: new Map([[rootNode.id, rootNode]]),
    rootId: rootNode.id,
    currentNodeId: rootNode.id,
  };
  
  return tree;
}

/**
 * Navigate to a specific node in the tree
 * Updates the currentNodeId
 */
export function navigateToNode(tree: LearningTree, nodeId: string): void {
  if (!tree.nodes.has(nodeId)) {
    throw new Error(`Node ${nodeId} not found in tree`);
  }
  tree.currentNodeId = nodeId;
}

/**
 * Get the current node
 */
export function getCurrentNode(tree: LearningTree): TreeNode | null {
  return getNode(tree, tree.currentNodeId);
}

/**
 * Serialize tree to plain object for localStorage
 * Converts Map to array
 */
export function serializeTree(tree: LearningTree): SerializedTree {
  const nodes = Array.from(tree.nodes.values()).map(node => ({
    id: node.id,
    segment: node.segment,
    parentId: node.parentId,
    childIds: node.childIds,
    branchIndex: node.branchIndex,
    branchLabel: node.branchLabel,
  }));
  
  return {
    nodes,
    rootId: tree.rootId,
    currentNodeId: tree.currentNodeId,
  };
}

/**
 * Deserialize tree from localStorage format
 * Reconstructs Map from array
 */
export function deserializeTree(data: SerializedTree): LearningTree {
  const nodes = new Map<string, TreeNode>();
  
  for (const nodeData of data.nodes) {
    nodes.set(nodeData.id, {
      id: nodeData.id,
      segment: nodeData.segment,
      parentId: nodeData.parentId,
      childIds: nodeData.childIds,
      branchIndex: nodeData.branchIndex,
      branchLabel: nodeData.branchLabel,
    });
  }
  
  return {
    nodes,
    rootId: data.rootId,
    currentNodeId: data.currentNodeId,
  };
}

/**
 * Save tree to localStorage
 */
export function saveLearningTree(sessionId: string, tree: LearningTree): void {
  try {
    const serialized = serializeTree(tree);
    localStorage.setItem(`learning_tree_${sessionId}`, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save tree to localStorage:', error);
  }
}

/**
 * Load tree from localStorage
 */
export function loadLearningTree(sessionId: string): LearningTree | null {
  try {
    const data = localStorage.getItem(`learning_tree_${sessionId}`);
    if (!data) return null;
    
    const serialized: SerializedTree = JSON.parse(data);
    return deserializeTree(serialized);
  } catch (error) {
    console.error('Failed to load tree from localStorage:', error);
    return null;
  }
}

/**
 * Convert legacy linear session to tree structure
 * Migration helper for old sessions
 */
export function convertLegacySession(legacySession: LegacyVideoSession): LearningTree | null {
  if (legacySession.segments.length === 0) return null;
  
  // Create root from first segment
  const tree = initializeTree(legacySession.segments[0]);
  
  // Add remaining segments as linear children
  let currentNodeId = tree.rootId;
  for (let i = 1; i < legacySession.segments.length; i++) {
    const newNode = addChildNode(tree, currentNodeId, legacySession.segments[i]);
    currentNodeId = newNode.id;
  }
  
  // Set current to the session's current index
  const allNodes = getAllNodes(tree);
  if (legacySession.currentIndex < allNodes.length) {
    tree.currentNodeId = allNodes[legacySession.currentIndex].id;
  }
  
  return tree;
}

/**
 * Check if a node is a leaf (has no children)
 */
export function isLeafNode(tree: LearningTree, nodeId: string): boolean {
  const node = getNode(tree, nodeId);
  return node ? node.childIds.length === 0 : false;
}

/**
 * Get the depth of a node (distance from root)
 */
export function getNodeDepth(tree: LearningTree, nodeId: string): number {
  return getPathFromRoot(tree, nodeId).length - 1;
}

/**
 * Count total nodes in the tree
 */
export function getTreeSize(tree: LearningTree): number {
  return tree.nodes.size;
}

/**
 * Get all leaf nodes (nodes with no children)
 */
export function getLeafNodes(tree: LearningTree): TreeNode[] {
  return getAllNodes(tree).filter(node => node.childIds.length === 0);
}

/**
 * Check if a node is an ancestor of another node
 */
export function isAncestor(tree: LearningTree, ancestorId: string, descendantId: string): boolean {
  const path = getPathFromRoot(tree, descendantId);
  return path.some(node => node.id === ancestorId);
}

