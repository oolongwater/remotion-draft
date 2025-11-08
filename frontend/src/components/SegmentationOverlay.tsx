/**
 * SegmentationOverlay Component
 * 
 * Displays segmentation masks as overlays on video
 * Shows polygon outlines and optional labels for detected objects
 */

import { useEffect, useRef } from 'react';
import { SegmentationMask } from '../services/segmentationService';

interface SegmentationOverlayProps {
  masks: SegmentationMask[];
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
  showLabels?: boolean;
  objectLabel?: string; // Context-aware label (e.g., "Chloroplast")
}

export const SegmentationOverlay: React.FC<SegmentationOverlayProps> = ({
  masks,
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
  showLabels = true,
  objectLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw masks on canvas when they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ Canvas ref not found');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ Canvas context not found');
      return;
    }
    
    console.log('🎨 Drawing segmentation overlay:');
    console.log('  Canvas size:', canvas.width, 'x', canvas.height);
    console.log('  Display size:', displayWidth, 'x', displayHeight);
    console.log('  Video size:', videoWidth, 'x', videoHeight);
    console.log('  Number of masks:', masks.length);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale factors (video coordinates -> display coordinates)
    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;
    
    console.log('  Scale factors:', scaleX, 'x', scaleY);
    
    // Draw each mask
    masks.forEach((mask, index) => {
      console.log(`  Mask ${index + 1}:`, mask.polygon.length, 'points, score:', mask.score);
      
      if (mask.polygon.length === 0) {
        console.log(`  ⚠️ Mask ${index + 1} has no polygon points`);
        return;
      }
      
      // Draw polygon outline
      ctx.beginPath();
      
      // Move to first point
      const [firstX, firstY] = mask.polygon[0];
      ctx.moveTo(firstX * scaleX, firstY * scaleY);
      
      // Draw lines to other points
      for (let i = 1; i < mask.polygon.length; i++) {
        const [x, y] = mask.polygon[i];
        ctx.lineTo(x * scaleX, y * scaleY);
      }
      
      // Close path
      ctx.closePath();
      
      // Style based on confidence score
      const hue = 180 + (mask.score * 60); // 180 (cyan) to 240 (blue)
      const alpha = 0.3 + (mask.score * 0.2); // 0.3 to 0.5
      
      // Fill with semi-transparent color
      ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`;
      ctx.fill();
      
      // Stroke outline
      ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.9)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      console.log(`  ✓ Drew mask ${index + 1} with color hue=${hue}, alpha=${alpha}`);
      
      // Draw label if enabled
      if (showLabels) {
        const [bboxX, bboxY, bboxW] = mask.bbox;
        const labelX = (bboxX + bboxW / 2) * scaleX;
        const labelY = bboxY * scaleY - 10;
        
        // Draw label background - use context-aware label if available
        const labelText = objectLabel 
          ? `${objectLabel} (${(mask.score * 100).toFixed(0)}%)`
          : `Object ${index + 1} (${(mask.score * 100).toFixed(0)}%)`;
        ctx.font = '14px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const padding = 8;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(
          labelX - textMetrics.width / 2 - padding / 2,
          labelY - 16,
          textMetrics.width + padding,
          20
        );
        
        // Draw label text
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX, labelY - 6);
      }
    });
  }, [masks, videoWidth, videoHeight, displayWidth, displayHeight, showLabels, objectLabel]);
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={displayWidth}
        height={displayHeight}
        className="absolute inset-0"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
      
      {/* Info display */}
      <div className="absolute bottom-2 left-2 bg-black/75 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
        {objectLabel ? (
          <>
            <div className="font-semibold mb-1 text-blue-300">{objectLabel}</div>
            <div className="text-slate-400">
              Confidence: {(masks[0].score * 100).toFixed(1)}%
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold mb-1">Segmentation Active</div>
            <div className="text-slate-300">
              {masks.length} object{masks.length !== 1 ? 's' : ''} detected
            </div>
            {masks.length > 0 && (
              <div className="text-slate-400 mt-1">
                Best confidence: {(masks[0].score * 100).toFixed(1)}%
              </div>
            )}
          </>
        )}
        <div className="text-slate-500 mt-1 text-[10px]">
          Click black area to clear
        </div>
      </div>
    </div>
  );
};

/**
 * Loading indicator for segmentation in progress
 */
export const SegmentationLoading: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/75 text-white px-4 py-3 rounded-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm">Analyzing object...</span>
        </div>
      </div>
    </div>
  );
};

