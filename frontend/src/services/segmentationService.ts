/**
 * Segmentation Service
 * 
 * Client-side service for interactive image segmentation.
 * Captures video frames and sends them to the backend SAM API.
 */

/**
 * Segmentation mask result from backend
 */
export interface SegmentationMask {
  polygon: [number, number][];  // Array of [x, y] coordinates
  score: number;                 // Confidence score (0-1)
  bbox: [number, number, number, number];  // [x, y, width, height]
  mask_rle?: string;             // Run-length encoding (optional)
}

/**
 * Segmentation API response
 */
export interface SegmentationResponse {
  success: boolean;
  masks?: SegmentationMask[];
  image_size?: {
    width: number;
    height: number;
  };
  click_point?: {
    x: number;
    y: number;
  };
  error?: string;
}

/**
 * Extract current frame from video element as base64-encoded image
 */
export function extractVideoFrame(videoElement: HTMLVideoElement): string | null {
  try {
    // Create canvas with video dimensions
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw current video frame
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return null;
    }
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 JPEG (smaller than PNG)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
    return dataUrl;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.error('CORS Error: Video source needs proper CORS headers.');
      console.error('Make sure:');
      console.error('1. Video element has crossOrigin="anonymous" attribute');
      console.error('2. Video server sends Access-Control-Allow-Origin header');
      console.error('Video URL:', videoElement.src);
    } else {
      console.error('Error extracting video frame:', error);
    }
    return null;
  }
}

/**
 * Get click coordinates relative to video element
 * Returns normalized coordinates (0-1)
 */
export function getVideoClickCoordinates(
  event: React.MouseEvent<HTMLElement>,
  videoElement: HTMLVideoElement
): { x: number; y: number } {
  const rect = videoElement.getBoundingClientRect();
  
  // Click position relative to video element
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  
  // Normalize to 0-1 range
  const normalizedX = clickX / rect.width;
  const normalizedY = clickY / rect.height;
  
  return {
    x: Math.max(0, Math.min(1, normalizedX)),
    y: Math.max(0, Math.min(1, normalizedY)),
  };
}

/**
 * Call segmentation API with video frame and click coordinates
 */
export async function segmentVideoClick(
  frameBase64: string,
  clickX: number,
  clickY: number,
  multimaskOutput: boolean = false
): Promise<SegmentationResponse> {
  try {
    // Use the environment variable configured during deployment
    const API_URL = import.meta.env.VITE_SEGMENTATION_API_URL || 
                    'https://chengluileng--segmentation-api-segment-click.modal.run';
    
    console.log(`Calling segmentation API at (${clickX.toFixed(3)}, ${clickY.toFixed(3)})...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: frameBase64,
        click_x: clickX,
        click_y: clickY,
        multimask_output: multimaskOutput,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data: SegmentationResponse = await response.json();
    
    if (data.success) {
      console.log(`✓ Segmentation successful: ${data.masks?.length} mask(s) returned`);
    } else {
      console.error('Segmentation failed:', data.error);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error calling segmentation API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * High-level function: Handle video click and return segmentation
 */
export async function handleVideoSegmentation(
  event: React.MouseEvent<HTMLElement>,
  videoElement: HTMLVideoElement
): Promise<SegmentationResponse | null> {
  try {
    // 1. Extract current frame
    const frameBase64 = extractVideoFrame(videoElement);
    if (!frameBase64) {
      console.error('Failed to extract video frame');
      return null;
    }
    
    // 2. Get click coordinates
    const { x, y } = getVideoClickCoordinates(event, videoElement);
    
    console.log(`Video clicked at normalized (${x.toFixed(3)}, ${y.toFixed(3)})`);
    
    // 3. Call segmentation API
    const result = await segmentVideoClick(frameBase64, x, y);
    
    return result;
    
  } catch (error) {
    console.error('Error in video segmentation:', error);
    return null;
  }
}

