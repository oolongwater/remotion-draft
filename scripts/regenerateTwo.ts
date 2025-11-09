#!/usr/bin/env node
/**
 * Quick script to regenerate Binary Search Trees and Photosynthesis
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetch } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODAL_ENDPOINT = 'https://video-gen-2--main-video-generator-dev-generate-video-api.modal.run/';
const OUTPUT_DIR = join(__dirname, '../frontend/public/cached-sessions');
const TOPICS = ['Binary Search Trees', 'Photosynthesis'];

interface SectionDetail {
  section: number;
  video_url: string;
  thumbnail_url?: string;
  title?: string;
  voiceover_script?: string;
}

interface GenerationProgress {
  status: 'processing' | 'completed' | 'failed';
  message?: string;
  section_details?: SectionDetail[];
  error?: string;
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

function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeTopicName(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/['\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function buildVideoSession(topic: string, sectionDetails: SectionDetail[]) {
  const nodes = new Map<string, TreeNode>();
  const rootIds: string[] = [];
  
  let previousNodeId: string | null = null;
  
  sectionDetails.forEach((detail, index) => {
    const segment: VideoSegment = {
      id: `segment_${index + 1}`,
      manimCode: '',
      duration: 30,
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
      branchIndex: index === 0 ? 0 : 0,
      branchLabel: undefined,
    };

    nodes.set(node.id, node);

    if (index === 0) {
      rootIds.push(node.id);
    } else if (previousNodeId) {
      const parentNode = nodes.get(previousNodeId);
      if (parentNode) {
        parentNode.childIds.push(node.id);
      }
    }

    previousNodeId = node.id;
  });

  return {
    tree: {
      nodes: Array.from(nodes.entries()),
      rootIds,
      currentNodeId: rootIds[0] || '',
    },
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

async function generateTopic(topic: string) {
  console.log(`\n🎬 Generating: ${topic}`);
  
  let finalSectionDetails: SectionDetail[] | undefined;
  
  try {
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      bodyTimeout: 900000,
      headersTimeout: 120000,
      keepaliveTimeout: 60000,
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status}`);
      return false;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error(`  ❌ No response body`);
      return false;
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
            if (data.message) console.log(`  📊 ${data.message}`);
            if (data.section_details) finalSectionDetails = data.section_details;
          } catch {}
        }
      }
    }

    if (finalSectionDetails && finalSectionDetails.length > 0) {
      console.log(`  ✅ Got ${finalSectionDetails.length} sections`);
      const session = buildVideoSession(topic, finalSectionDetails);
      const filename = `${sanitizeTopicName(topic)}.json`;
      await writeFile(join(OUTPUT_DIR, filename), JSON.stringify(session, null, 2));
      console.log(`  💾 Saved: ${filename}`);
      return true;
    } else {
      console.error(`  ❌ No sections received`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    if (finalSectionDetails && finalSectionDetails.length > 0) {
      console.log(`  ℹ️  Got ${finalSectionDetails.length} sections despite error`);
      const session = buildVideoSession(topic, finalSectionDetails);
      const filename = `${sanitizeTopicName(topic)}.json`;
      await writeFile(join(OUTPUT_DIR, filename), JSON.stringify(session, null, 2));
      console.log(`  💾 Saved: ${filename}`);
      return true;
    }
    return false;
  }
}

async function main() {
  console.log('🔄 Regenerating Binary Search Trees and Photosynthesis\n');
  
  for (const topic of TOPICS) {
    await generateTopic(topic);
    if (topic !== TOPICS[TOPICS.length - 1]) {
      console.log('\n⏳ Waiting 5 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n✅ Done!');
}

main();

