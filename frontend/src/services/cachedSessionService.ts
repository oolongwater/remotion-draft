/**
 * cachedSessionService.ts
 * 
 * Service for loading pre-cached video sessions.
 * These sessions are pre-generated and stored as static JSON files
 * for instant loading when users click example topics.
 */

import { VideoSession } from '../types/VideoConfig';

/**
 * Map of topic names to their cached session files
 * Must match the topics in LandingPage.tsx
 */
const CACHED_SESSIONS: Record<string, string> = {
  'Binary Search Trees': '/cached-sessions/binary-search-trees.json',
  'Photosynthesis': '/cached-sessions/photosynthesis.json',
  'Pythagoras Theorem': '/cached-sessions/pythagoras-theorem.json',
};

/**
 * Check if a topic has a pre-cached session available
 */
export function hasCachedSession(topic: string): boolean {
  return topic in CACHED_SESSIONS;
}

/**
 * Load a pre-cached session for a topic
 * Returns null if the session doesn't exist or fails to load
 */
export async function loadCachedSession(
  topic: string
): Promise<VideoSession | null> {
  const sessionPath = CACHED_SESSIONS[topic];
  
  if (!sessionPath) {
    console.log(`No cached session available for: ${topic}`);
    return null;
  }

  try {
    console.log(`Loading cached session from: ${sessionPath}`);
    const response = await fetch(sessionPath);
    
    if (!response.ok) {
      console.error(`Failed to load cached session: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Deserialize the tree (Map objects need special handling)
    // The stored format has nodes as [[key, value], [key, value], ...]
    const tree = {
      ...data.tree,
      nodes: new Map(data.tree.nodes),
    };

    console.log(`✅ Loaded cached session for "${topic}"`);
    console.log(`   Nodes: ${tree.nodes.size}`);
    console.log(`   Root: ${tree.rootIds[0]}`);

    return {
      ...data,
      tree,
    };
  } catch (error) {
    console.error(`Error loading cached session for "${topic}":`, error);
    return null;
  }
}

/**
 * Get list of all topics that have cached sessions
 */
export function getCachedTopics(): string[] {
  return Object.keys(CACHED_SESSIONS);
}

