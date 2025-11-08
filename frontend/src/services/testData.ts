/**
 * testData.ts
 * 
 * Mock data for quick testing without calling the backend
 * Uses placeholder videos for instant testing
 */

import { VideoSegment } from '../types/VideoConfig';

/**
 * Mock plan structure
 */
export const TEST_PLAN = {
  description: "Understanding the Pythagorean Theorem through visual proofs",
  learning_goals: ["Understand the theorem", "See visual proof"],
  visual_approach: "Geometric demonstration with animated squares",
  video_structure: [
    {
      section: "Introduction to Pythagorean Theorem",
      duration: "45 seconds",
      content: "Introduce the theorem a² + b² = c² and show the right triangle with squares on each side"
    },
    {
      section: "Visual Proof",
      duration: "45 seconds",
      content: "Demonstrate the visual proof by showing how the areas of the two smaller squares equal the area of the largest square"
    }
  ]
};

/**
 * Mock video segments with placeholder videos
 * 
 * Free test videos available online:
 * 
 * Google Cloud Storage samples:
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4
 * - https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4
 * 
 * Blender Foundation:
 * - http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4 (Big Buck Bunny)
 * 
 * Sample-Videos.com:
 * - https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4 (short)
 * - https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4 (short)
 * - https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4 (short)
 */
export const TEST_SEGMENTS: VideoSegment[] = [
  {
    id: 'test_segment_1',
    manimCode: '',
    duration: 45,
    hasQuestion: true,
    questionText: 'What does the Pythagorean Theorem state?',
    questionOptions: [
      'a² + b² = c² for right triangles',
      'a + b = c for all triangles',
      'The sum of angles equals 180°',
      'The area equals base times height'
    ],
    correctAnswer: 'a² + b² = c² for right triangles',
    topic: 'Pythagorean Theorem',
    difficulty: 'medium',
    generatedAt: new Date().toISOString(),
    // Using Big Buck Bunny - a popular open-source test video
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    renderingStatus: 'completed',
  },
  {
    id: 'test_segment_2',
    manimCode: '',
    duration: 45,
    hasQuestion: true,
    questionText: 'How does the visual proof demonstrate the Pythagorean Theorem?',
    questionOptions: [
      'By showing that the areas of two smaller squares equal the largest square',
      'By measuring the sides with a ruler',
      'By using algebra to solve for c',
      'By drawing many triangles'
    ],
    correctAnswer: 'By showing that the areas of two smaller squares equal the largest square',
    topic: 'Pythagorean Theorem',
    difficulty: 'medium',
    generatedAt: new Date().toISOString(),
    // Using Sintel - another open-source test video (shorter than Elephants Dream)
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    renderingStatus: 'completed',
  }
];

/**
 * Mock section URLs (for backward compatibility)
 */
export const TEST_SECTION_URLS = TEST_SEGMENTS.map(seg => seg.videoUrl!);

