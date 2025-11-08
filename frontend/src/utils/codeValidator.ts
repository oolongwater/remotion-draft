/**
 * codeValidator.ts
 * 
 * Security utilities for validating and sanitizing LLM-generated code
 * before execution.
 */

/**
 * List of dangerous patterns that should not be allowed in generated code
 */
const DANGEROUS_PATTERNS = [
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /new\s+Function/gi,
  /document\./gi,
  /window\./gi,
  /localStorage/gi,
  /sessionStorage/gi,
  /fetch\s*\(/gi,
  /XMLHttpRequest/gi,
  /import\s*\(/gi,
  /require\s*\(/gi,
  /__proto__/gi,
  /constructor\s*\[/gi,
  /process\./gi,
  /global\./gi,
  /globalThis\./gi,
];

/**
 * Allowed import sources that can be used in generated code
 */
const ALLOWED_IMPORTS = [
  'react',
  'remotion',
  '../components',
  './components',
  '../utils/animationEngine',
  './utils/animationEngine',
  '../LayoutEngine',
  './LayoutEngine',
];

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate generated code for security issues
 */
export function validateCode(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }

  // Check for suspicious string operations that might be attempts to bypass validation
  if (code.includes('String.fromCharCode') || code.includes('String.fromCodePoint')) {
    warnings.push('String encoding detected - verify this is necessary');
  }

  // Check for excessive complexity (potential DoS)
  const lines = code.split('\n');
  if (lines.length > 500) {
    warnings.push('Code is very long (>500 lines) - this may impact performance');
  }

  // Check for deep nesting (potential infinite loops or performance issues)
  const maxNestingLevel = getMaxNestingLevel(code);
  if (maxNestingLevel > 10) {
    warnings.push('Deep nesting detected - verify loops and recursion are bounded');
  }

  // Check imports
  const importMatches = code.matchAll(/from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    const importPath = match[1];
    const isAllowed = ALLOWED_IMPORTS.some(allowed => 
      importPath.startsWith(allowed) || importPath === allowed
    );
    if (!isAllowed) {
      errors.push(`Disallowed import: ${importPath}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate maximum nesting level in code
 */
function getMaxNestingLevel(code: string): number {
  let maxLevel = 0;
  let currentLevel = 0;

  for (const char of code) {
    if (char === '{' || char === '(') {
      currentLevel++;
      maxLevel = Math.max(maxLevel, currentLevel);
    } else if (char === '}' || char === ')') {
      currentLevel--;
    }
  }

  return maxLevel;
}

/**
 * Sanitize code by removing comments and normalizing whitespace
 */
export function sanitizeCode(code: string): string {
  // Remove single-line comments
  let sanitized = code.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Normalize whitespace but preserve structure
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Extract imports from code
 */
export function extractImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]*}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Check if code contains export statement
 */
export function hasExport(code: string): boolean {
  return /export\s+(const|function|default)/i.test(code);
}

/**
 * Validate that code exports a component
 */
export function validateComponentExport(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hasExport(code)) {
    errors.push('Code must export a component');
  }

  // Check for React component pattern
  const hasReactImport = /import\s+.*React.*from\s+['"]react['"]/i.test(code);
  const hasComponentPattern = /export\s+(const|function)\s+\w+.*=.*\(.*\)\s*=>/i.test(code) ||
                              /export\s+function\s+\w+.*\(.*\)/i.test(code);

  if (!hasReactImport && hasComponentPattern) {
    warnings.push('Component detected but React not imported');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

