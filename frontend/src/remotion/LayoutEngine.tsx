/**
 * LayoutEngine.tsx
 * 
 * Provides layout utilities and components for dynamic scenes.
 * Supports flex, grid, absolute, and stack layouts.
 */

import React, { CSSProperties } from 'react';
import {
  LayoutConfig,
  FlexLayoutConfig,
  GridLayoutConfig,
  AbsoluteLayoutConfig,
  StackLayoutConfig,
} from '../types/SceneConfig';

/**
 * Convert padding config to CSS padding string
 */
function getPaddingStyle(
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }
): string | undefined {
  if (typeof padding === 'number') {
    return `${padding}px`;
  }
  if (padding) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = padding;
    return `${top}px ${right}px ${bottom}px ${left}px`;
  }
  return undefined;
}

/**
 * Flex Layout Component
 */
export const FlexLayout: React.FC<
  FlexLayoutConfig & { children: React.ReactNode; style?: CSSProperties }
> = ({ children, direction, justify, align, wrap, gap, padding, style = {} }) => {
  const flexStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction || 'row',
    justifyContent: justify === 'start' ? 'flex-start' 
      : justify === 'end' ? 'flex-end'
      : justify || 'flex-start',
    alignItems: align === 'start' ? 'flex-start'
      : align === 'end' ? 'flex-end'
      : align || 'flex-start',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: gap ? `${gap}px` : undefined,
    padding: getPaddingStyle(padding),
    ...style,
  };

  return <div style={flexStyle}>{children}</div>;
};

/**
 * Grid Layout Component
 */
export const GridLayout: React.FC<
  GridLayoutConfig & { children: React.ReactNode; style?: CSSProperties }
> = ({ children, columns, rows, gap, columnGap, rowGap, areas, padding, style = {} }) => {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : undefined,
    gridTemplateRows: rows ? `repeat(${rows}, 1fr)` : undefined,
    gap: gap ? `${gap}px` : undefined,
    columnGap: columnGap ? `${columnGap}px` : undefined,
    rowGap: rowGap ? `${rowGap}px` : undefined,
    gridTemplateAreas: areas ? areas.map(area => `"${area}"`).join('\n') : undefined,
    padding: getPaddingStyle(padding),
    ...style,
  };

  return <div style={gridStyle}>{children}</div>;
};

/**
 * Absolute Layout Component
 */
export const AbsoluteLayout: React.FC<
  AbsoluteLayoutConfig & { children: React.ReactNode; style?: CSSProperties }
> = ({ children, anchor, x, y, width, height, style = {} }) => {
  // Calculate position based on anchor
  const getPosition = (): CSSProperties => {
    const baseStyle: CSSProperties = {
      position: 'absolute',
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    };

    if (x !== undefined || y !== undefined) {
      // Use explicit x/y if provided
      return {
        ...baseStyle,
        left: typeof x === 'number' ? `${x}px` : x,
        top: typeof y === 'number' ? `${y}px` : y,
      };
    }

    // Use anchor positioning
    switch (anchor) {
      case 'top-left':
        return { ...baseStyle, top: 0, left: 0 };
      case 'top-center':
        return { ...baseStyle, top: 0, left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { ...baseStyle, top: 0, right: 0 };
      case 'center-left':
        return { ...baseStyle, top: '50%', left: 0, transform: 'translateY(-50%)' };
      case 'center':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'center-right':
        return { ...baseStyle, top: '50%', right: 0, transform: 'translateY(-50%)' };
      case 'bottom-left':
        return { ...baseStyle, bottom: 0, left: 0 };
      case 'bottom-center':
        return { ...baseStyle, bottom: 0, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
        return { ...baseStyle, bottom: 0, right: 0 };
      default:
        return { ...baseStyle, top: 0, left: 0 };
    }
  };

  const absoluteStyle = {
    ...getPosition(),
    ...style,
  };

  return <div style={absoluteStyle}>{children}</div>;
};

/**
 * Stack Layout Component
 * Children are stacked on top of each other with z-index
 */
export const StackLayout: React.FC<
  StackLayoutConfig & { children: React.ReactNode; style?: CSSProperties }
> = ({ children, align, justify, padding, style = {} }) => {
  const stackStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: align === 'start' ? 'flex-start'
      : align === 'end' ? 'flex-end'
      : align || 'center',
    justifyContent: justify === 'start' ? 'flex-start'
      : justify === 'end' ? 'flex-end'
      : justify || 'center',
    padding: getPaddingStyle(padding),
    ...style,
  };

  return (
    <div style={stackStyle}>
      {React.Children.map(children, (child, index) => (
        <div style={{ position: 'absolute', zIndex: index }}>
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * Universal Layout Component
 * Renders the appropriate layout based on config type
 */
export const Layout: React.FC<{
  config?: LayoutConfig;
  children: React.ReactNode;
  style?: CSSProperties;
}> = ({ config, children, style }) => {
  if (!config) {
    // Default to flex column
    return (
      <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
        {children}
      </div>
    );
  }

  switch (config.type) {
    case 'flex':
      return <FlexLayout {...config} style={style}>{children}</FlexLayout>;
    case 'grid':
      return <GridLayout {...config} style={style}>{children}</GridLayout>;
    case 'absolute':
      return <AbsoluteLayout {...config} style={style}>{children}</AbsoluteLayout>;
    case 'stack':
      return <StackLayout {...config} style={style}>{children}</StackLayout>;
    default:
      return <div style={style}>{children}</div>;
  }
};

/**
 * Layout utility helpers
 */
export const LayoutHelpers = {
  /**
   * Create a two-column layout
   */
  twoColumn: (gap: number = 20): GridLayoutConfig => ({
    type: 'grid',
    columns: 2,
    gap,
  }),

  /**
   * Create a three-column layout
   */
  threeColumn: (gap: number = 20): GridLayoutConfig => ({
    type: 'grid',
    columns: 3,
    gap,
  }),

  /**
   * Create a centered flex layout
   */
  centered: (): FlexLayoutConfig => ({
    type: 'flex',
    direction: 'column',
    justify: 'center',
    align: 'center',
  }),

  /**
   * Create a horizontal row layout
   */
  row: (gap: number = 20, justify: FlexLayoutConfig['justify'] = 'start'): FlexLayoutConfig => ({
    type: 'flex',
    direction: 'row',
    justify,
    align: 'center',
    gap,
  }),

  /**
   * Create a vertical column layout
   */
  column: (gap: number = 20, align: FlexLayoutConfig['align'] = 'start'): FlexLayoutConfig => ({
    type: 'flex',
    direction: 'column',
    justify: 'start',
    align,
    gap,
  }),
};

