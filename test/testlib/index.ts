import 'reflect-metadata'; // Used by @fp8/simple-config

// Read the local env file for testing
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

// Configure logger
import { LogLevel, SimpleTextDestination } from 'jlog-facade';
SimpleTextDestination.use(LogLevel.WARNING);

// Create logger
import { createLogger } from '@fp8proj/core';
export const testLogger = createLogger('test');

// Export test classes
export { expect } from '@jest/globals';
export * from './helper';
export * from './test-fstore';
export * from './test-models';
export * from './timer';
