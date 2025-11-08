/**
 * MorphingElement.tsx
 * 
 * Component that renders a single visual element with smooth morphing capabilities.
 * Can be a circle, rect, triangle, star, line, or text.
 */

import React from 'react';
import { makeCircle, makeRect, makeTriangle, makeStar, makePolygon } from '@remotion/shapes';
import { VisualElement, ElementType } from '../../types/AnimationInstruction';

interface MorphingElementProps {
  element: VisualElement;
  colors: {
    background: string;
    primary: string;
    secondary?: string;
    accent?: string;
    text: string;
  };
}

/**
 * Generate SVG path for a shape type
 */
function getShapePath(type: ElementType, properties: any): string {
  const size = properties.width || properties.radius || 100;
  
  try {
    switch (type) {
      case 'circle':
        return makeCircle({ radius: properties.radius || size / 2 }).path;
      case 'rect':
        return makeRect({ 
          width: properties.width || size, 
          height: properties.height || size 
        }).path;
      case 'triangle':
        return makeTriangle({ length: size, direction: 'up' }).path;
      case 'star':
        return makeStar({ 
          points: 5, 
          innerRadius: size * 0.4, 
          outerRadius: size 
        }).path;
      case 'polygon':
        return makePolygon({ points: 6, radius: size / 2 }).path;
      default:
        return makeCircle({ radius: size / 2 }).path;
    }
  } catch (e) {
    // Fallback to circle if shape generation fails
    return makeCircle({ radius: 50 }).path;
  }
}

export const MorphingElement: React.FC<MorphingElementProps> = ({
  element,
  colors,
}) => {
  const { type, properties } = element;
  
  // Handle text elements
  if (type === 'text') {
    return (
      <text
        x={properties.x || 0}
        y={properties.y || 0}
        fill={properties.fill || colors.text}
        fontSize={properties.fontSize || 32}
        fontWeight={properties.fontWeight || 'normal'}
        textAnchor={properties.textAlign === 'center' ? 'middle' : properties.textAlign === 'right' ? 'end' : 'start'}
        opacity={properties.opacity ?? 1}
      >
        {properties.text || ''}
      </text>
    );
  }
  
  // Handle line elements
  if (type === 'line' || type === 'connection') {
    const x1 = properties.x1 ?? properties.x ?? 0;
    const y1 = properties.y1 ?? properties.y ?? 0;
    const x2 = properties.x2 ?? (properties.x ?? 0) + (properties.width ?? 100);
    const y2 = properties.y2 ?? properties.y ?? 0;
    
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={properties.stroke || properties.fill || colors.primary}
        strokeWidth={properties.strokeWidth || 2}
        opacity={properties.opacity ?? 1}
        strokeDasharray={properties.dashed ? '5,5' : undefined}
      />
    );
  }
  
  // Handle shape elements
  const x = properties.x || 0;
  const y = properties.y || 0;
  const rotation = properties.rotation || 0;
  const scale = properties.scale || 1;
  const opacity = properties.opacity ?? 1;
  
  // Get the SVG path for this shape
  const path = properties.path || getShapePath(type, properties);
  
  // Calculate transform origin (center of the shape)
  const size = properties.width || properties.radius || 100;
  const originX = size / 2;
  const originY = size / 2;
  
  return (
    <g
      transform={`translate(${x}, ${y})`}
      opacity={opacity}
    >
      <g
        transform={`rotate(${rotation}, ${originX}, ${originY}) scale(${scale})`}
        style={{ transformOrigin: `${originX}px ${originY}px` }}
      >
        <path
          d={path}
          fill={properties.fill || colors.primary}
          stroke={properties.stroke}
          strokeWidth={properties.strokeWidth || 0}
        />
      </g>
    </g>
  );
};

