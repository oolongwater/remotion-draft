/**
 * EvolutionController.tsx
 * 
 * Controller for managing evolution script generation and extension.
 * Handles pre-generation of scripts and seamless extension of the composition.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EvolutionScript } from '../types/EvolutionScript';
import { generateEvolutionScript } from '../services/llmService';

interface EvolutionControllerProps {
  topic: string;
  initialDuration?: number; // Duration of first script in frames
  extensionDuration?: number; // Duration of extension scripts in frames
  extensionThreshold?: number; // When to trigger extension (0-1, e.g., 0.8 = 80% through)
  onError?: (error: string) => void;
  children: (state: EvolutionControllerState) => React.ReactNode;
}

interface EvolutionControllerState {
  scripts: EvolutionScript[];
  currentScript: EvolutionScript | null;
  isGenerating: boolean;
  isExtending: boolean;
  totalDuration: number;
  error: string | null;
  extendEvolution: (userAnswer?: string, wasCorrect?: boolean) => Promise<void>;
}

/**
 * EvolutionController Component
 * 
 * Manages the lifecycle of evolution scripts, including generation and extension.
 */
export const EvolutionController: React.FC<EvolutionControllerProps> = ({
  topic,
  initialDuration = 1800, // 1 minute at 30fps
  extensionDuration = 1800,
  extensionThreshold = 0.8,
  onError,
  children,
}) => {
  const [scripts, setScripts] = useState<EvolutionScript[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isInitialized = useRef(false);
  const isExtensionQueued = useRef(false);
  
  // Calculate total duration
  const totalDuration = scripts.reduce((acc, script) => acc + script.duration, 0);
  
  // Get current script (the first/active one)
  const currentScript = scripts.length > 0 ? scripts[0] : null;
  
  /**
   * Generate the initial evolution script
   */
  const generateInitialScript = useCallback(async () => {
    if (isInitialized.current) return;
    
    console.log('Generating initial evolution script for topic:', topic);
    setIsGenerating(true);
    setError(null);
    isInitialized.current = true;
    
    try {
      const response = await generateEvolutionScript({
        topic,
        duration: initialDuration,
      });
      
      if (response.success && response.script) {
        console.log('Initial evolution script generated:', response.script);
        setScripts([response.script]);
      } else {
        const errorMsg = response.error || 'Failed to generate evolution script';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [topic, initialDuration, onError]);
  
  /**
   * Extend the evolution with a new script
   */
  const extendEvolution = useCallback(async (userAnswer?: string, wasCorrect?: boolean) => {
    if (isExtensionQueued.current) {
      console.log('Extension already queued, skipping');
      return;
    }
    
    const lastScript = scripts[scripts.length - 1];
    if (!lastScript) {
      console.warn('No existing script to extend from');
      return;
    }
    
    console.log('Extending evolution from script:', lastScript.id);
    isExtensionQueued.current = true;
    setIsExtending(true);
    setError(null);
    
    try {
      const response = await generateEvolutionScript({
        topic,
        previousScript: lastScript,
        duration: extensionDuration,
        userAnswer,
        wasCorrect,
      });
      
      if (response.success && response.script) {
        console.log('Evolution extended with new script:', response.script);
        setScripts(prev => [...prev, response.script!]);
      } else {
        const errorMsg = response.error || 'Failed to extend evolution';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsExtending(false);
      isExtensionQueued.current = false;
    }
  }, [scripts, topic, extensionDuration, onError]);
  
  /**
   * Automatically extend when approaching end of current scripts
   */
  const checkAndExtend = useCallback((currentFrame: number) => {
    if (isExtending || isExtensionQueued.current) return;
    
    const threshold = totalDuration * extensionThreshold;
    
    if (currentFrame >= threshold && totalDuration > 0) {
      console.log(`Frame ${currentFrame} reached extension threshold (${threshold}), extending...`);
      extendEvolution();
    }
  }, [totalDuration, extensionThreshold, isExtending, extendEvolution]);
  
  // Generate initial script on mount
  useEffect(() => {
    if (!isInitialized.current) {
      generateInitialScript();
    }
  }, [generateInitialScript]);
  
  // Build the state object for children
  const state: EvolutionControllerState = {
    scripts,
    currentScript,
    isGenerating,
    isExtending,
    totalDuration,
    error,
    extendEvolution,
  };
  
  return <>{children(state)}</>;
};

