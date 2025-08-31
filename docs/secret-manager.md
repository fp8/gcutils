# Secret Manager Module Documentation

The Secret Manager module provides a service-oriented interface for Google Cloud Secret Manager with built-in caching, version management, and error handling.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Secret Naming](#secret-naming)
- [API Reference](#api-reference)
- [Utility Functions](#utility-functions)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Overview

The Secret Manager module simplifies Google Cloud Secret Manager operations through:

- **Async factory pattern** for proper initialization
- **In-memory caching** of loaded secrets for performance
- **Version management** with pipe notation or object interface
- **Bulk secret loading** during service initialization
- **Type-safe secret access** with error handling
- **Utility functions** for secret path parsing

## Core Components

### SecretsService

Main service class providing:
- Factory method for async initialization
- Bulk secret loading and caching
- Version-aware secret access
- Secret listing capabilities
- Error handling with optional defaults

### Utility Functions

Helper functions for:
- Secret name and version parsing
- Secret path construction
- Name extraction from full paths

## Getting Started

### Basic Usage

```typescript
import { SecretsService } from '@fp8/gcutils/secret-manager';

// Create service and load secrets
const secretsService = await SecretsService.create(
    'database-password',
    'api-key',
    'jwt-secret|2'  // specific version
);

// Access loaded secrets
const dbPassword = secretsService.get('database-password');
const apiKey = secretsService.get('api-key');
const jwtSecret = secretsService.get('jwt-secret|2');
```

### With Default Values

```typescript
// Provide default values for missing secrets
const debugMode = secretsService.get('debug-mode', 'false');
const maxRetries = secretsService.get('max-retries', '3');
```

### Dynamic Secret Access

```typescript
// Access secrets not loaded during initialization
const dynamicSecret = await secretsService.accessSecretVersion('runtime-config');
const specificVersion = await secretsService.accessSecretVersion('config|1');
```

## Secret Naming

### Basic Secret Names

Simple secret names default to the `latest` version:

```typescript
'my-secret'  // Equivalent to 'my-secret|latest'
```

### Version Specification

Use pipe notation to specify versions:

```typescript
'my-secret|1'        // Version 1
'my-secret|2'        // Version 2  
'my-secret|latest'   // Latest version (explicit)
```

### Object Interface

Alternative object-based specification:

```typescript
{
    name: 'my-secret',
    version: '1'
}
```

## API Reference

### SecretsService Class

#### Static Factory Method

##### create()
```typescript
static async create(...secrets: string[]): Promise<SecretsService>
```

Creates and initializes a new `SecretsService` instance with the specified secrets.

**Parameters:**
- `secrets`: Array of secret names to load during initialization

**Returns:** Promise resolving to configured `SecretsService` instance

**Example:**
```typescript
const service = await SecretsService.create(
    'database-url',
    'redis-password|3',
    'encryption-key'
);
```

#### Properties

##### gcloudProjectId
```typescript
gcloudProjectId: string | undefined
```
The Google Cloud project ID detected during initialization.

##### store
```typescript
get store(): Map<string, string>
```
Read-only access to the internal secret store.

#### Methods

##### get()
```typescript
get(secret: string, defaultIfNull?: string): string
```

Retrieves a secret from the internal cache.

**Parameters:**
- `secret`: Secret name (with optional version using pipe notation)
- `defaultIfNull`: Optional default value if secret is not found

**Returns:** Secret value or default value

**Throws:** Error if secret not found and no default provided

**Examples:**
```typescript
// Required secret (throws if missing)
const dbPassword = service.get('database-password');

// Optional secret with default
const timeout = service.get('timeout-seconds', '30');
```

##### listSecrets()
```typescript
async listSecrets(): Promise<Record<string, string>>
```

Lists all secrets in the project.

**Returns:** Promise resolving to object mapping secret names to their full paths

**Example:**
```typescript
const allSecrets = await service.listSecrets();
console.log(Object.keys(allSecrets)); // ['secret1', 'secret2', ...]
```

##### accessSecretVersion()
```typescript
async accessSecretVersion(secret: string | ISecretNameVersion): Promise<string | undefined>
```

Directly accesses a secret version from Google Cloud Secret Manager.

**Parameters:**
- `secret`: Secret name with optional version or `ISecretNameVersion` object

**Returns:** Promise resolving to secret value or `undefined` if not found

**Examples:**
```typescript
// Access latest version
const latest = await service.accessSecretVersion('api-key');

// Access specific version with pipe notation
const v1 = await service.accessSecretVersion('api-key|1');

// Access specific version with object
const v2 = await service.accessSecretVersion({
    name: 'api-key',
    version: '2'
});
```

## Utility Functions

### parseSecretNameToNameVersion()
```typescript
function parseSecretNameToNameVersion(secret: string | ISecretNameVersion): ISecretNameVersion
```

Parses secret input into name and version components.

**Parameters:**
- `secret`: Secret string or object

**Returns:** Object with `name` and `version` properties

**Examples:**
```typescript
parseSecretNameToNameVersion('my-secret');
// Returns: { name: 'my-secret', version: 'latest' }

parseSecretNameToNameVersion('my-secret|2');
// Returns: { name: 'my-secret', version: '2' }

parseSecretNameToNameVersion({ name: 'my-secret', version: '1' });
// Returns: { name: 'my-secret', version: '1' }
```

### parseSecretNameFromSecretPath()
```typescript
function parseSecretNameFromSecretPath(secretPath: string): string | undefined
```

Extracts secret name from full Google Cloud secret path.

**Parameters:**
- `secretPath`: Full secret path from Google Cloud

**Returns:** Secret name or `undefined` if parsing fails

**Example:**
```typescript
const path = 'projects/my-project/secrets/database-password';
const name = parseSecretNameFromSecretPath(path);
// Returns: 'database-password'
```

### getSecretPathFromSecretNameVersion()
```typescript
function getSecretPathFromSecretNameVersion(
    projectId: string | undefined,
    secret: string | ISecretNameVersion
): string
```

Constructs full secret path for Google Cloud Secret Manager API.

**Parameters:**
- `projectId`: Google Cloud project ID
- `secret`: Secret name with optional version

**Returns:** Full secret path

**Example:**
```typescript
const path = getSecretPathFromSecretNameVersion(
    'my-project',
    'database-password|1'
);
// Returns: 'projects/my-project/secrets/database-password/versions/1'
```

## Interfaces

### ISecretNameVersion
```typescript
interface ISecretNameVersion {
    name: string;
    version: string;
}
```

Object representation of a secret with explicit version.

## Testing

### Mock Setup

For testing, mock the Google Cloud Secret Manager client:

```typescript
import { SecretsService } from '@fp8/gcutils/secret-manager';

// Mock the SecretManagerServiceClient
jest.mock('@google-cloud/secret-manager', () => ({
    SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
        getProjectId: jest.fn().mockResolvedValue('test-project'),
        accessSecretVersion: jest.fn(),
        listSecrets: jest.fn()
    }))
}));

describe('SecretsService Tests', () => {
    it('should load and retrieve secrets', async () => {
        const service = await SecretsService.create('test-secret');
        
        // Mock secret retrieval
        const mockClient = service['client'];
        mockClient.accessSecretVersion.mockResolvedValue([{
            payload: { data: Buffer.from('secret-value') }
        }]);
        
        const value = await service.accessSecretVersion('test-secret');
        expect(value).toBe('secret-value');
    });
});
```

### Integration Testing

```typescript
describe('SecretsService Integration', () => {
    let service: SecretsService;

    beforeAll(async () => {
        // Ensure test secrets exist in your project
        service = await SecretsService.create('test-secret');
    });

    it('should retrieve actual secrets', async () => {
        const secret = service.get('test-secret');
        expect(secret).toBeDefined();
        expect(typeof secret).toBe('string');
    });
});
```

## Best Practices

### 1. Initialize Once

Create the service once during application startup:

```typescript
class Application {
    private secretsService: SecretsService;
    
    async initialize() {
        this.secretsService = await SecretsService.create(
            'database-url',
            'api-keys',
            'jwt-secret'
        );
    }
}
```

### 2. Handle Missing Secrets

Always provide defaults for non-critical secrets:

```typescript
const debugMode = service.get('debug-mode', 'false');
const logLevel = service.get('log-level', 'info');
```

### 3. Version Management

Use explicit versions for critical secrets:

```typescript
const service = await SecretsService.create(
    'production-db-password|3',  // Explicit version
    'jwt-signing-key|2'
);
```

### 4. Error Handling

Wrap secret access in try-catch for critical secrets:

```typescript
try {
    const criticalSecret = service.get('critical-secret');
    // Use secret
} catch (error) {
    console.error('Failed to retrieve critical secret:', error);
    process.exit(1);
}
```

### 5. Secret Rotation

For secret rotation, update version numbers:

```typescript
// Old version
const oldService = await SecretsService.create('api-key|1');

// New version after rotation
const newService = await SecretsService.create('api-key|2');
```

## Examples

### Web Application Setup

```typescript
import { SecretsService } from '@fp8/gcutils/secret-manager';

class WebApp {
    private secrets: SecretsService;
    
    async start() {
        // Load all required secrets
        this.secrets = await SecretsService.create(
            'database-url',
            'redis-url', 
            'jwt-secret|2',
            'api-key',
            'encryption-key'
        );
        
        // Initialize database with secret
        await this.initDatabase(this.secrets.get('database-url'));
        
        // Start server
        this.startServer();
    }
    
    private async initDatabase(url: string) {
        // Database initialization
    }
    
    private startServer() {
        const port = this.secrets.get('port', '3000');
        // Server startup
    }
}
```

### Configuration Service

```typescript
class ConfigService {
    constructor(private secrets: SecretsService) {}
    
    getDatabaseConfig() {
        return {
            url: this.secrets.get('database-url'),
            maxConnections: parseInt(this.secrets.get('db-max-connections', '10')),
            timeout: parseInt(this.secrets.get('db-timeout', '5000'))
        };
    }
    
    getRedisConfig() {
        return {
            url: this.secrets.get('redis-url'),
            ttl: parseInt(this.secrets.get('redis-ttl', '3600'))
        };
    }
}
```

### Dynamic Secret Access

```typescript
class RuntimeConfigService {
    constructor(private secrets: SecretsService) {}
    
    async getFeatureFlags(): Promise<Record<string, boolean>> {
        // Dynamically load feature flags secret
        const flagsJson = await this.secrets.accessSecretVersion('feature-flags');
        
        if (flagsJson) {
            return JSON.parse(flagsJson);
        }
        
        return {}; // Default empty flags
    }
    
    async updateApiKey(): Promise<void> {
        // Get latest API key version
        const newKey = await this.secrets.accessSecretVersion('api-key');
        
        if (newKey) {
            // Update runtime configuration
            process.env.API_KEY = newKey;
        }
    }
}
```

## Error Scenarios

### Common Error Cases

1. **Missing Secret**: Secret not found in Secret Manager
2. **Version Not Found**: Specified version doesn't exist
3. **Access Denied**: Insufficient permissions
4. **Network Issues**: Connectivity problems

### Error Handling Patterns

```typescript
// Pattern 1: Default values
const config = {
    timeout: parseInt(service.get('timeout', '5000')),
    retries: parseInt(service.get('retries', '3'))
};

// Pattern 2: Try-catch with fallback
let apiKey: string;
try {
    apiKey = service.get('api-key');
} catch (error) {
    console.warn('API key not found, using environment variable');
    apiKey = process.env.API_KEY || 'default-key';
}

// Pattern 3: Graceful degradation
const features = {
    enableAnalytics: service.get('enable-analytics', 'false') === 'true',
    enableCache: service.get('enable-cache', 'true') === 'true'
};
```
