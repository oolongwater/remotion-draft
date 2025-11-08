/**
 * LayoutEngine.tsx
 * 
 * Provides layout utilities for dynamic scenes.
 * Supports flex, grid, absolute positioning, and stack layouts.
 */

import React from 'react';
import {
  LayoutConfig,
  FlexLayoutConfig,
  GridLayoutConfig,
  AbsoluteLayoutConfig,
  StackLayoutConfig,
} from '../types/SceneConfig';

/**
 * Convert padding config to CSS string
 */
function getPaddingStyle(
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }
): string {
  if (padding === undefined) return '0';
  if (typeof padding === 'number') return `${padding}px`;
  
  const { top = 0, right = 0, bottom = 0, left = 0 } = padding;
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

/**
 * Flex Layout Component
 */
export const FlexLayout: React.FC<{
  config: FlexLayoutConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const {
    direction = 'row',
    justify = 'start',
    align = 'start',
    wrap = false,
    gap = 0,
    padding,
  } = config;
  
  const justifyMap = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    'space-between': 'space-between',
    'space-around': 'space-around',
    'space-evenly': 'space-evenly',
  };
  
  const alignMap = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    stretch: 'stretch',
    baseline: 'baseline',
  };
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        justifyContent: justifyMap[justify],
        alignItems: alignMap[align],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: `${gap}px`,
        padding: getPaddingStyle(padding),
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
};

/**
 * Grid Layout Component
 */
export const GridLayout: React.FC<{
  config: GridLayoutConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const {
    columns,
    rows,
    gap,
    columnGap,
    rowGap,
    areas,
    padding,
  } = config;
  
  const style: React.CSSProperties = {
    display: 'grid',
    width: '100%',
    height: '100%',
    padding: getPaddingStyle(padding),
  };
  
  if (columns) {
    style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  }
  
  if (rows) {
    style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }
  
  if (gap !== undefined) {
    style.gap = `${gap}px`;
  }
  
  if (columnGap !== undefined) {
    style.columnGap = `${columnGap}px`;
  }
  
  if (rowGap !== undefined) {
    style.rowGap = `${rowGap}px`;
  }
  
  if (areas && areas.length > 0) {
    style.gridTemplateAreas = areas.map(area => `"${area}"`).join(' ');
  }
  
  return <div style={style}>{children}</div>;
};

/**
 * Absolute Layout Component
 */
export const AbsoluteLayout: React.FC<{
  config: AbsoluteLayoutConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const { anchor = 'top-left', x, y, width, height } = config;
  
  const anchorStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 0, left: 0 },
    'top-center': { top: 0, left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: 0, right: 0 },
    'center-left': { top: '50%', left: 0, transform: 'translateY(-50%)' },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'center-right': { top: '50%', right: 0, transform: 'translateY(-50%)' },
    'bottom-left': { bottom: 0, left: 0 },
    'bottom-center': { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: 0, right: 0 },
  };
  
  const style: React.CSSProperties = {
    position: 'absolute',
    ...anchorStyles[anchor],
  };
  
  if (x !== undefined) {
    style.left = typeof x === 'number' ? `${x}px` : x;
    delete style.right;
  }
  
  if (y !== undefined) {
    style.top = typeof y === 'number' ? `${y}px` : y;
    delete style.bottom;
  }
  
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  
  return <div style={style}>{children}</div>;
};

/**
 * Stack Layout Component (layers elements on top of each other)
 */
export const StackLayout: React.FC<{
  config: StackLayoutConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const { align = 'center', justify = 'center', padding } = config;
  
  const alignMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  };
  
  const justifyMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  };
  
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        width: '100%',
        height: '100%',
        padding: getPaddingStyle(padding),
      }}
    >
      {React.Children.map(children, (child, index) => (
        <div
          style={{
            position: index === 0 ? 'relative' : 'absolute',
            zIndex: index,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * Main Layout Engine Component - dispatches to appropriate layout
 */
export const LayoutEngine: React.FC<{
  config?: LayoutConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  if (!config) {
    // Default: just render children
    return <>{children}</>;
  }
  
  switch (config.type) {
    case 'flex':
      return <FlexLayout config={config}>{children}</FlexLayout>;
    case 'grid':
      return <GridLayout config={config}>{children}</GridLayout>;
    case 'absolute':
      return <AbsoluteLayout config={config}>{children}</AbsoluteLayout>;
    case 'stack':
      return <StackLayout config={config}>{children}</StackLayout>;
    default:
      return <>{children}</>;
  }
};

