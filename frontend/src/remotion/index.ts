/**
 * index.ts
 * 
 * Remotion entry point - registers the root component
 * This file is used by Remotion CLI commands and the Remotion Studio
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);

