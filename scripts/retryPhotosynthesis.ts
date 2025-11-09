#!/usr/bin/env node
/**
 * Quick script to retry just Photosynthesis
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
const TOPIC = 'Photosynthesis';

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

async function generatePhotosynthesis() {
  console.log(`🎬 Generating video for: ${TOPIC}\n`);
  
  let finalSectionDetails: SectionDetail[] | undefined;
  
  try {
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic: TOPIC }),
      bodyTimeout: 900000, // 15 minutes
      headersTimeout: 120000, // 2 minutes
      keepaliveTimeout: 60000, // 1 minute
    });

    if (!response.ok) {
      console.error(`❌ Request failed: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error(`❌ No response body`);
      return;
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
            if (data.message) {
              console.log(`  📊 ${data.message}`);
            }
            if (data.section_details) {
              finalSectionDetails = data.section_details;
            }
          } catch {}
        }
      }
    }

    if (finalSectionDetails && finalSectionDetails.length > 0) {
      console.log(`\n✅ Got ${finalSectionDetails.length} sections!`);
      
      // Build session
      const session = {
        tree: {
          nodes: finalSectionDetails.map((detail, i) => {
            const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            return [id, {
              id,
              segment: {
                id: `segment_${i + 1}`,
                manimCode: '',
                duration: 30,
                hasQuestion: false,
                topic: detail.title || `${TOPIC} - Part ${detail.section}`,
                difficulty: 'medium',
                generatedAt: new Date().toISOString(),
                videoUrl: detail.video_url,
                thumbnailUrl: detail.thumbnail_url,
                title: detail.title,
                renderingStatus: 'completed',
                voiceoverScript: detail.voiceover_script,
              },
              parentId: i === 0 ? null : `node_prev`,
              childIds: [],
              branchIndex: 0,
              branchLabel: undefined,
            }];
          }),
          rootIds: ['node_first'],
          currentNodeId: 'node_first',
        },
        context: {
          initialTopic: TOPIC,
          historyTopics: [TOPIC],
          depth: finalSectionDetails.length,
          correctnessPattern: [],
          preferredStyle: 'mixed',
        },
        sessionId: `cached_${Date.now()}`,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };

      const filepath = join(OUTPUT_DIR, 'photosynthesis.json');
      await writeFile(filepath, JSON.stringify(session, null, 2));
      console.log(`✅ Saved to: photosynthesis.json`);
    } else {
      console.error(`❌ No section details received`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error);
    if (finalSectionDetails && finalSectionDetails.length > 0) {
      console.log(`\n  ℹ️  But we did get ${finalSectionDetails.length} sections before error!`);
    }
  }
}

generatePhotosynthesis();

