/**
 * DynamicSceneRenderer.tsx
 * 
 * Safely executes and renders LLM-generated component code.
 * Provides a sandboxed environment with whitelisted imports and utilities.
 */

import React, { Component, ErrorInfo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import * as BuildingBlocks from './components';
import * as AnimationEngine from '../utils/animationEngine';
import { LayoutEngine } from '../utils/LayoutEngine';

// Import types for the new system
interface DynamicSceneConfig {
  type: 'dynamic';
  id?: string;
  duration: number;
  componentCode: string;
  animations?: any[];
  layout?: any;
  props?: Record<string, any>;
  colors?: {
    background?: string;
    primary?: string;
    secondary?: string;
    text?: string;
    accent?: string;
  };
}

/**
 * Error Boundary for catching runtime errors in dynamic components
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DynamicSceneErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dynamic Scene Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AbsoluteFill
          style={{
            backgroundColor: '#1e293b',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: 48,
              color: '#ef4444',
              marginBottom: 20,
            }}
          >
            ⚠️ Scene Error
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#cbd5e1',
              textAlign: 'center',
              maxWidth: 800,
              marginBottom: 20,
            }}
          >
            There was an error rendering this scene
          </div>
          <div
            style={{
              fontSize: 16,
              color: '#94a3b8',
              backgroundColor: '#0f172a',
              padding: 20,
              borderRadius: 8,
              fontFamily: 'monospace',
              maxWidth: 800,
              overflow: 'auto',
            }}
          >
            {this.state.error?.message}
          </div>
        </AbsoluteFill>
      );
    }

    return this.props.children;
  }
}

/**
 * Validate component code for dangerous patterns
 */
function validateCode(code: string): { valid: boolean; error?: string } {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval\(/i,
    /Function\(/i,
    /\bimport\s+/i,
    /\brequire\(/i,
    /\bprocess\./i,
    /\bglobal\./i,
    /\bwindow\.location/i,
    /\bdocument\.cookie/i,
    /\blocalStorage\./i,
    /\bsessionStorage\./i,
    /<script/i,
    /\bfetch\(/i,
    /\bXMLHttpRequest/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains potentially dangerous pattern: ${pattern}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get list of available components for error messages
 */
function getAvailableComponents(): string {
  return `
Available Components:
- KineticText: Animated text with fly-in effects
- RevealBlock: Content reveals with wipes and transitions
- Timeline: Orchestrate multiple elements in sequence
- Transition: Smooth transitions between content
- FloatingElements: Ambient background elements
- SplitScreen: Dynamic split layouts
- AnimatedText: Character-by-character text reveals
- CodeBlock: Syntax-highlighted code
- Card: Content containers
- Chart: Data visualizations
- Diagram: Flowcharts and diagrams
- TwoColumnLayout: Side-by-side layouts
- ProgressBar: Animated progress bars

Available Remotion Hooks:
- useCurrentFrame(): Get current frame number
- useVideoConfig(): Get video config (fps, width, height)
- interpolate(): Animate values
- spring(): Physics-based animations
- AbsoluteFill: Full-screen container

IMPORTANT:
- React is available as "React"
- Use React.createElement() - JSX syntax is NOT supported
- Example: React.createElement('div', {style: {...}}, 'content')
`;
}

/**
 * Create a safe execution context for the component
 */
function createSafeContext() {
  return {
    // React (both default export and namespace)
    React,
    
    // Remotion hooks and utilities
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    AbsoluteFill,
    
    // Building blocks (all components)
    ...BuildingBlocks,
    
    // Animation engine
    ...AnimationEngine,
    
    // Layout engine
    LayoutEngine,
    
    // Safe utility functions
    console: {
      log: (...args: any[]) => console.log('[Dynamic Scene]', ...args),
      warn: (...args: any[]) => console.warn('[Dynamic Scene]', ...args),
      error: (...args: any[]) => console.error('[Dynamic Scene]', ...args),
    },
  };
}

/**
 * Execute component code and return the component
 */
function executeComponentCode(
  code: string,
  props: Record<string, any>
): React.ComponentType<any> | null {
  try {
    // Create safe context
    const context = createSafeContext();
    
    // Build parameter list and values
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);
    
    // Wrap code in a function that returns the component
    const wrappedCode = `
      'use strict';
      ${code}
      
      // Return the default export or the Scene component
      return typeof Scene !== 'undefined' ? Scene : null;
    `;
    
    // Create and execute function
    const componentFactory = new Function(...paramNames, wrappedCode);
    const Component = componentFactory(...paramValues);
    
    if (!Component) {
      throw new Error('Component code must export a Scene component');
    }
    
    return Component;
  } catch (error) {
    console.error('Failed to execute component code:', error);
    throw error;
  }
}

/**
 * Main Dynamic Scene Renderer Component
 */
interface DynamicSceneRendererProps {
  config: DynamicSceneConfig;
}

export const DynamicSceneRenderer: React.FC<DynamicSceneRendererProps> = ({ config }) => {
  // Validate code
  const validation = validateCode(config.componentCode);
  
  if (!validation.valid) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 48, color: '#ef4444', marginBottom: 20 }}>
          ⚠️ Security Error
        </div>
          <div
            style={{
              fontSize: 24,
              color: '#cbd5e1',
              textAlign: 'center',
              maxWidth: 800,
              marginBottom: 20,
            }}
          >
            {validation.error}
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#94a3b8',
              backgroundColor: '#0f172a',
              padding: 20,
              borderRadius: 8,
              fontFamily: 'monospace',
              maxWidth: 800,
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
            }}
          >
            {getAvailableComponents()}
          </div>
      </AbsoluteFill>
    );
  }

  try {
    // Execute code and get component
    const DynamicComponent = executeComponentCode(
      config.componentCode,
      config.props || {}
    );

    if (!DynamicComponent) {
      throw new Error('Failed to create component from code');
    }

    // Render with error boundary
    return (
      <DynamicSceneErrorBoundary>
        <DynamicComponent
          {...(config.props || {})}
          colors={config.colors}
          animations={config.animations}
          layout={config.layout}
        />
      </DynamicSceneErrorBoundary>
    );
  } catch (error) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 48, color: '#ef4444', marginBottom: 20 }}>
          ⚠️ Compilation Error
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#cbd5e1',
            textAlign: 'center',
            maxWidth: 800,
            marginBottom: 20,
          }}
        >
          Failed to compile component code
        </div>
        <div
          style={{
            fontSize: 16,
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            padding: 20,
            borderRadius: 8,
            fontFamily: 'monospace',
            maxWidth: 800,
            overflow: 'auto',
            marginBottom: 20,
          }}
        >
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#94a3b8',
            backgroundColor: '#0f172a',
            padding: 20,
            borderRadius: 8,
            fontFamily: 'monospace',
            maxWidth: 800,
            overflow: 'auto',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
          }}
        >
          {getAvailableComponents()}
        </div>
      </AbsoluteFill>
    );
  }
};

