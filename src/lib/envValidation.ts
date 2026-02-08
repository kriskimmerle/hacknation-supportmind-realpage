/**
 * Environment validation for TicketWhisperer
 * Validates required environment variables at startup
 */

import { existsSync } from "fs";
import { DATASET_PATH } from "./config";

export interface EnvConfig {
  OPENAI_API_KEY: string;
  DATASET_PATH: string;
  PROJECT_DATA_DIR: string;
}

export interface ValidationResult {
  valid: boolean;
  config: Partial<EnvConfig>;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment configuration at startup.
 * Call this early in the application lifecycle.
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: OPENAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    errors.push("OPENAI_API_KEY is required but not set");
  } else if (!openaiKey.startsWith("sk-")) {
    warnings.push("OPENAI_API_KEY does not start with 'sk-' - verify it is valid");
  }

  // Required: Dataset file must exist
  if (!existsSync(DATASET_PATH)) {
    errors.push(
      `Dataset file not found at: ${DATASET_PATH}\n` +
      `  Set DATASET_PATH env var or place file at .data/SupportMind__Final_Data.xlsx`
    );
  }

  const config: Partial<EnvConfig> = {
    OPENAI_API_KEY: openaiKey ? `${openaiKey.slice(0, 7)}...${openaiKey.slice(-4)}` : undefined,
    DATASET_PATH: DATASET_PATH,
    PROJECT_DATA_DIR: process.env.PROJECT_DATA_DIR || ".data",
  };

  return {
    valid: errors.length === 0,
    config,
    errors,
    warnings,
  };
}

/**
 * Validates environment and logs results.
 * Throws if validation fails (for use in server startup).
 */
export function validateEnvOrThrow(): EnvConfig {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    console.warn("⚠️  Environment warnings:");
    result.warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  if (!result.valid) {
    console.error("❌ Environment validation failed:");
    result.errors.forEach((e) => console.error(`   - ${e}`));
    throw new Error(`Environment validation failed: ${result.errors.join("; ")}`);
  }

  console.log("✅ Environment validated:");
  console.log(`   OPENAI_API_KEY: ${result.config.OPENAI_API_KEY}`);
  console.log(`   DATASET_PATH: ${result.config.DATASET_PATH}`);
  console.log(`   PROJECT_DATA_DIR: ${result.config.PROJECT_DATA_DIR}`);

  return result.config as EnvConfig;
}

/**
 * Lightweight check for API routes - doesn't throw, just returns boolean
 */
export function isEnvValid(): boolean {
  return validateEnv().valid;
}
