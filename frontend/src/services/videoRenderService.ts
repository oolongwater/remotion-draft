/**
 * videoRenderService.ts
 *
 * Service for generating videos via Modal backend.
 * This service handles communication with the Modal API using Server-Sent Events (SSE).
 */

import { VideoSegment } from "../types/VideoConfig";

/**
 * Video section information from the plan
 */
export interface VideoSectionInfo {
  section: string;
  duration: string;
  content: string;
}

/**
 * Mega plan structure from the backend
 */
export interface MegaPlan {
  description?: string;
  learning_goals?: string[];
  visual_approach?: string;
  video_structure?: VideoSectionInfo[];
}

/**
 * Progress update from the backend
 */
export interface GenerationProgress {
  status: "processing" | "completed" | "failed";
  stage?: number;
  stage_name?: string;
  progress_percentage?: number;
  message?: string;
  job_id?: string;
  sections?: string[]; // List of section video URLs (only in completion)
  plan?: MegaPlan; // Mega plan with section details
  error?: string;
  metadata?: {
    prompt?: string;
    num_sections?: number;
  };
}

/**
 * Generate all video scenes for a topic using Modal backend
 * Returns a promise that resolves with all section URLs when complete
 */
export async function generateVideoScenes(
  topic: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<{
  success: boolean;
  sections?: string[];
  plan?: MegaPlan;
  error?: string;
  jobId?: string;
}> {
  const modalEndpoint =
    "https://evan-zhangmingjun--main-video-generator-dev-generate-video-api.modal.run";

  try {
    console.log("Generating video scenes for topic:", topic);

    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: topic,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Request failed: ${response.status} ${response.statusText}. ${errorText}`,
      };
    }

    // Handle SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      return {
        success: false,
        error: "No response body received",
      };
    }

    let buffer = "";
    let finalSections: string[] | undefined;
    let megaPlan: MegaPlan | undefined;
    let jobId: string | undefined;
    let finalStatus: "processing" | "completed" | "failed" = "processing";
    let finalError: string | undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as GenerationProgress;

            // Update progress
            if (data.job_id) {
              jobId = data.job_id;
            }

            // Capture the mega plan when it's sent
            if (data.plan) {
              megaPlan = data.plan;
            }

            if (data.status === "completed" && data.sections) {
              finalSections = data.sections;
              finalStatus = "completed";
            } else if (data.status === "failed") {
              finalStatus = "failed";
              finalError = data.error || "Generation failed";
            }

            // Call progress callback
            onProgress?.(data);
          } catch (parseError) {
            console.warn("Failed to parse SSE data:", line, parseError);
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const line = buffer.trim();
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6)) as GenerationProgress;
          if (data.status === "completed" && data.sections) {
            finalSections = data.sections;
            finalStatus = "completed";
          }
          onProgress?.(data);
        } catch (parseError) {
          console.warn("Failed to parse final SSE data:", parseError);
        }
      }
    }

    if (finalStatus === "completed" && finalSections) {
      return {
        success: true,
        sections: finalSections,
        plan: megaPlan,
        jobId,
      };
    } else if (finalStatus === "failed") {
      return {
        success: false,
        error: finalError || "Generation failed",
        jobId,
      };
    } else {
      return {
        success: false,
        error: "Generation did not complete successfully",
        jobId,
      };
    }
  } catch (error) {
    console.error("Video generation error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error occurred during generation",
    };
  }
}

/**
 * @deprecated Use generateVideoScenes instead
 * Legacy function kept for backward compatibility
 */
export async function renderManimVideo(
  _segment: VideoSegment
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  console.warn(
    "renderManimVideo is deprecated. Use generateVideoScenes instead."
  );
  return {
    success: false,
    error: "This function is deprecated. Use generateVideoScenes instead.",
  };
}

/**
 * @deprecated Status checking is no longer needed with SSE streaming
 */
export async function checkRenderingStatus(
  _segmentId: string
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  console.warn(
    "checkRenderingStatus is deprecated. Progress is now handled via SSE in generateVideoScenes."
  );
  return {
    status: "failed",
    error:
      "This function is deprecated. Use generateVideoScenes with onProgress callback instead.",
  };
}
