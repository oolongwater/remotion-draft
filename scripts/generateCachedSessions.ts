#!/usr/bin/env node
/**
 * generateCachedSessions.ts
 * 
 * Script to pre-generate video sessions for all example topics.
 * Calls the backend Modal endpoint, waits for completion, and saves
 * the resulting VideoSession as JSON files for instant loading.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetch } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Topics to pre-generate
const TOPICS = [
  'Binary Search Trees',
  'Photosynthesis',
  'Pythagoras Theorem',
];

// Backend endpoint
const MODAL_ENDPOINT = 'https://video-gen-2--main-video-generator-dev-generate-video-api.modal.run/';

// Output directory
const OUTPUT_DIR = join(__dirname, '../frontend/public/cached-sessions');

interface SectionDetail {
  section: number;
  video_url: string;
  thumbnail_url?: string;
  title?: string;
  voiceover_script?: string;
}

interface GenerationProgress {
  status: 'processing' | 'completed' | 'failed';
  stage?: number;
  stage_name?: string;
  progress_percentage?: number;
  message?: string;
  job_id?: string;
  sections?: string[];
  section_details?: SectionDetail[];
  error?: string;
  metadata?: {
    prompt?: string;
    num_sections?: number;
    voiceover_scripts?: Array<{ section: number; script: string }>;
  };
}

interface VideoSegment {
  id: string;
  manimCode: string;
  duration: number;
  hasQuestion: boolean;
  questionText?: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  generatedAt?: string;
  parentSegmentId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  renderingStatus?: 'pending' | 'rendering' | 'completed' | 'failed';
  voiceoverScript?: string;
  userAnswer?: string;
  isQuestionNode?: boolean;
}

interface TreeNode {
  id: string;
  segment: VideoSegment;
  parentId: string | null;
  childIds: string[];
  branchIndex: number;
  branchLabel?: string;
}

interface SerializedTree {
  nodes: Array<[string, TreeNode]>;
  rootIds: string[];
  currentNodeId: string;
}

interface VideoSession {
  tree: SerializedTree;
  context: {
    initialTopic: string;
    historyTopics: string[];
    depth: number;
    correctnessPattern: boolean[];
    preferredStyle: 'visual' | 'code-heavy' | 'conceptual' | 'mixed';
  };
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
}

/**
 * Generate a unique node ID
 */
function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Call backend and wait for video generation via SSE
 */
async function generateVideoForTopic(topic: string): Promise<{
  success: boolean;
  sectionDetails?: SectionDetail[];
  error?: string;
}> {
  console.log(`\n🎬 Generating video for: ${topic}`);
  
  // Declare these outside try block so they're accessible in catch
  let finalSectionDetails: SectionDetail[] | undefined;
  let finalStatus: 'processing' | 'completed' | 'failed' = 'processing';
  let finalError: string | undefined;
  
  try {
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
      bodyTimeout: 900000, // 15 minutes - extra time for complex topics
      headersTimeout: 120000, // 2 minutes for headers
      keepaliveTimeout: 60000, // 1 minute keepalive
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Request failed: ${response.status} ${response.statusText}`,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        error: 'No response body received',
      };
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as GenerationProgress;

            // Log progress
            if (data.message) {
              console.log(`  📊 ${data.message}`);
            }

            // Store section details whenever we receive them
            if (data.section_details) {
              finalSectionDetails = data.section_details;
            }

            if (data.status === 'completed') {
              finalStatus = 'completed';
            } else if (data.status === 'failed') {
              finalStatus = 'failed';
              finalError = data.error || 'Generation failed';
            }
          } catch (parseError) {
            console.warn('  ⚠️  Failed to parse SSE data:', parseError);
          }
        }
      }
    }

    // Check if we received section details (even if connection closed early)
    if (finalSectionDetails && finalSectionDetails.length > 0 && finalStatus !== 'failed') {
      console.log(`  ✅ Received ${finalSectionDetails.length} sections`);
      return {
        success: true,
        sectionDetails: finalSectionDetails,
      };
    }

    if (finalStatus === 'completed' && finalSectionDetails) {
      console.log(`  ✅ Generation completed with ${finalSectionDetails.length} sections`);
      return {
        success: true,
        sectionDetails: finalSectionDetails,
      };
    } else if (finalStatus === 'failed') {
      return {
        success: false,
        error: finalError || 'Generation failed',
      };
    } else {
      return {
        success: false,
        error: 'Generation did not complete successfully',
      };
    }
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    
    // Check if we got section details despite the error (connection closed early)
    if (finalSectionDetails && finalSectionDetails.length > 0) {
      console.log(`  ℹ️  Connection closed but ${finalSectionDetails.length} sections were received - treating as success`);
      return {
        success: true,
        sectionDetails: finalSectionDetails,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build VideoSession from section details
 */
function buildVideoSession(topic: string, sectionDetails: SectionDetail[]): VideoSession {
  const nodes = new Map<string, TreeNode>();
  const rootIds: string[] = [];
  
  let previousNodeId: string | null = null;
  
  sectionDetails.forEach((detail, index) => {
    const segment: VideoSegment = {
      id: `segment_${index + 1}`,
      manimCode: '', // Not needed for cached playback
      duration: 30, // Approximate
      hasQuestion: false,
      topic: detail.title || `${topic} - Part ${detail.section}`,
      difficulty: 'medium',
      generatedAt: new Date().toISOString(),
      videoUrl: detail.video_url,
      thumbnailUrl: detail.thumbnail_url,
      title: detail.title,
      renderingStatus: 'completed',
      voiceoverScript: detail.voiceover_script,
    };

    const node: TreeNode = {
      id: generateNodeId(),
      segment,
      parentId: previousNodeId,
      childIds: [],
      branchIndex: index === 0 ? 0 : 0, // Linear chain
      branchLabel: undefined,
    };

    nodes.set(node.id, node);

    if (index === 0) {
      // First node is root
      rootIds.push(node.id);
    } else if (previousNodeId) {
      // Add as child to previous node
      const parentNode = nodes.get(previousNodeId);
      if (parentNode) {
        parentNode.childIds.push(node.id);
      }
    }

    previousNodeId = node.id;
  });

  const serializedTree: SerializedTree = {
    nodes: Array.from(nodes.entries()),
    rootIds,
    currentNodeId: rootIds[0] || '',
  };

  return {
    tree: serializedTree,
    context: {
      initialTopic: topic,
      historyTopics: [topic],
      depth: sectionDetails.length,
      correctnessPattern: [],
      preferredStyle: 'mixed',
    },
    sessionId: `cached_${Date.now()}`,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Sanitize topic name for filename
 */
function sanitizeTopicName(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/['\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Generate session for a single topic and save to file
 */
async function generateAndSaveTopic(topic: string): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 Processing: ${topic}`);
  console.log('='.repeat(60));

  const result = await generateVideoForTopic(topic);

  if (!result.success || !result.sectionDetails) {
    console.error(`❌ Failed to generate video: ${result.error}`);
    return false;
  }

  console.log(`\n💾 Building session...`);
  const session = buildVideoSession(topic, result.sectionDetails);

  const filename = `${sanitizeTopicName(topic)}.json`;
  const filepath = join(OUTPUT_DIR, filename);

  try {
    await writeFile(filepath, JSON.stringify(session, null, 2));
    console.log(`✅ Saved to: ${filename}`);
    console.log(`   Nodes: ${session.tree.nodes.length}`);
    console.log(`   Root: ${session.tree.rootIds[0]}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save file:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🎥 Cached Video Session Generator');
  console.log('='.repeat(60));
  console.log(`Topics to generate: ${TOPICS.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Ensure output directory exists
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log('✅ Output directory ready\n');
  } catch (error) {
    console.error('❌ Failed to create output directory:', error);
    process.exit(1);
  }

  let successCount = 0;
  let failureCount = 0;

  // Generate sessions sequentially (to avoid rate limits)
  for (const topic of TOPICS) {
    const success = await generateAndSaveTopic(topic);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Wait a bit between requests to be polite
    if (topic !== TOPICS[TOPICS.length - 1]) {
      console.log('\n⏳ Waiting 5 seconds before next topic...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log('='.repeat(60));

  if (failureCount > 0) {
    console.log('\n⚠️  Some topics failed to generate. You may need to retry them.');
    process.exit(1);
  } else {
    console.log('\n🎉 All sessions generated successfully!');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

