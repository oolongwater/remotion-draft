/**
 * Manim Code Parser
 * 
 * Extracts object metadata from Manim Python code to enable precise
 * object identification based on timestamp and click position.
 */

export interface ManimObject {
  name: string;           // Variable name (e.g., "sun", "chloroplast")
  type: string;           // Object type (e.g., "Circle", "Text", "SVGMobject")
  position?: [number, number, number]; // [x, y, z] coordinates
  appearTime?: number;    // When object appears (seconds)
  displayName?: string;   // Cleaned name for display
}

export interface ManimTimeline {
  objects: ManimObject[];
  totalDuration: number;
}

/**
 * Parse Manim code to extract object metadata
 */
export function parseManimCode(code: string): ManimTimeline {
  const objects: ManimObject[] = [];
  let currentTime = 0;
  let pendingLabel: string | undefined;
  
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for Label comment: # Label: <name>
    const labelMatch = trimmed.match(/^#\s*Label:\s*(.+)$/i);
    if (labelMatch) {
      pendingLabel = labelMatch[1].trim();
      console.log(`🏷️  Found label comment: "${pendingLabel}"`);
      continue;
    }
    
    // Skip other comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Parse object creation: sun = Circle()
    const objectMatch = trimmed.match(/^(\w+)\s*=\s*(Circle|Square|Text|SVGMobject|Triangle|Rectangle|Polygon|Line|Arrow|Dot|Ellipse|Arc|Sector|RegularPolygon|VGroup)\s*\(/i);
    if (objectMatch) {
      const [, name, type] = objectMatch;
      
      // Try to extract position from move_to or shift
      let position: [number, number, number] | undefined;
      const moveToMatch = trimmed.match(/\.move_to\s*\(\s*\[?\s*([^,\]]+)\s*,\s*([^,\]]+)\s*(?:,\s*([^,\]]+))?\s*\]?\s*\)/);
      if (moveToMatch) {
        const [, x, y, z] = moveToMatch;
        position = [
          parseFloat(x) || 0,
          parseFloat(y) || 0,
          parseFloat(z || '0') || 0
        ];
      }
      
      // Use label from comment if available, otherwise clean the variable name
      const displayName = pendingLabel || cleanObjectName(name);
      
      objects.push({
        name,
        type,
        position,
        appearTime: currentTime,
        displayName
      });
      
      console.log(`📝 Parsed Manim object: ${name} (${type}) with label "${displayName}" at time ${currentTime}s`);
      
      // Clear pending label after use
      pendingLabel = undefined;
    }
    
    // Parse animations that affect timing
    // self.play(...) typically takes 1 second (default run_time)
    if (trimmed.includes('self.play(')) {
      const runTimeMatch = trimmed.match(/run_time\s*=\s*([\d.]+)/);
      const duration = runTimeMatch ? parseFloat(runTimeMatch[1]) : 1.0;
      currentTime += duration;
      
      // Check which object is being animated
      const animateMatch = trimmed.match(/self\.play\(\s*\w+\s*\(\s*(\w+)/);
      if (animateMatch) {
        const [, objName] = animateMatch;
        const obj = objects.find(o => o.name === objName);
        if (obj && obj.appearTime === undefined) {
          obj.appearTime = currentTime - duration; // Set appear time
        }
      }
    }
    
    // self.wait(duration)
    const waitMatch = trimmed.match(/self\.wait\s*\(\s*([\d.]+)\s*\)/);
    if (waitMatch) {
      currentTime += parseFloat(waitMatch[1]);
    }
    
    // Update position if object moves
    const transformMatch = trimmed.match(/self\.play\s*\(\s*\w*\.shift\s*\(\s*(\w+)\s*,/);
    if (transformMatch) {
      // Object is moving, but we'll use initial position for now
    }
  }
  
  return {
    objects,
    totalDuration: currentTime
  };
}

/**
 * Find the most likely object at a given position and timestamp
 */
export function findObjectAtPosition(
  timeline: ManimTimeline,
  clickX: number,
  clickY: number,
  timestamp: number,
  tolerance: number = 2.0
): ManimObject | null {
  // Normalize click coordinates (assuming video uses Manim's coordinate system)
  // Manim typically uses -7 to 7 for x, -4 to 4 for y
  // We need to map from normalized 0-1 click coords to Manim coords
  const manimX = (clickX - 0.5) * 14; // Map 0-1 to -7 to 7
  const manimY = (0.5 - clickY) * 8;  // Map 0-1 to 4 to -4 (inverted Y)
  
  console.log(`🔍 Looking for object at Manim coords (${manimX.toFixed(2)}, ${manimY.toFixed(2)}) at time ${timestamp.toFixed(1)}s`);
  
  // Filter objects that exist at this timestamp
  const activeObjects = timeline.objects.filter(obj => 
    obj.appearTime !== undefined && obj.appearTime <= timestamp
  );
  
  console.log(`   Active objects at this time: ${activeObjects.map(o => o.name).join(', ')}`);
  
  // Find closest object to click position
  let closest: ManimObject | null = null;
  let minDistance = Infinity;
  
  for (const obj of activeObjects) {
    if (!obj.position) continue;
    
    const [objX, objY] = obj.position;
    const distance = Math.sqrt(
      Math.pow(objX - manimX, 2) + Math.pow(objY - manimY, 2)
    );
    
    console.log(`   ${obj.name}: distance = ${distance.toFixed(2)}`);
    
    if (distance < minDistance && distance < tolerance) {
      minDistance = distance;
      closest = obj;
    }
  }
  
  if (closest) {
    console.log(`   ✓ Found: ${closest.displayName || closest.name} (distance: ${minDistance.toFixed(2)})`);
  } else {
    console.log(`   ✗ No object found within tolerance ${tolerance}`);
  }
  
  return closest;
}

/**
 * Clean up object names for display
 * Converts variable names like "chloroplast_1" to "Chloroplast"
 */
function cleanObjectName(name: string): string {
  // Remove numbers and underscores
  let cleaned = name.replace(/_\d+$/, '').replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  cleaned = cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return cleaned;
}

/**
 * Get object label from Manim code metadata
 */
export function getLabelFromManimCode(
  manimCode: string,
  clickX: number,
  clickY: number,
  timestamp: number
): string | undefined {
  console.log('🔍 getLabelFromManimCode called with:', {
    codeLength: manimCode?.length || 0,
    clickX,
    clickY,
    timestamp
  });
  
  if (!manimCode) {
    console.log('⚠️  No Manim code provided');
    return undefined;
  }
  
  try {
    const timeline = parseManimCode(manimCode);
    console.log(`📊 Parsed timeline: ${timeline.objects.length} objects found`);
    
    if (timeline.objects.length > 0) {
      console.log('   Objects:', timeline.objects.map(o => `${o.name} (${o.displayName})`));
    }
    
    const object = findObjectAtPosition(timeline, clickX, clickY, timestamp);
    
    if (object) {
      console.log(`✅ Found object: ${object.name} -> "${object.displayName}"`);
      return object.displayName || object.name;
    } else {
      console.log('❌ No object found at this position/time');
      return undefined;
    }
  } catch (error) {
    console.error('Error parsing Manim code:', error);
    return undefined;
  }
}

