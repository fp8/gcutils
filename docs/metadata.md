# Metadata Module Documentation

The Metadata module provides easy access to Google Cloud Metadata server to retrieve instance and project information when running on Google Cloud Platform.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Testing](#testing)

## Overview

The Metadata module simplifies access to Google Cloud's metadata service through:

- **Automatic caching** to improve performance and reduce API calls
- **Environment variable fallbacks** for local development
- **Type-safe access** to common metadata properties
- **Configurable regex parsing** for formatted metadata values
- **Debug logging** for troubleshooting

## Core Components

### GCloudMetadata

Main class for fetching and caching metadata from the Google Cloud Metadata server. Provides access to:
- Project ID and numeric project ID
- Instance region and zone information
- Service account email
- Custom metadata paths

## Getting Started

### Basic Usage

```typescript
import { GCloudMetadata } from '@farport/gcutils/metadata';

// Create instance with default metadata server
const metadata = new GCloudMetadata();

// Get project information
const projectId = await metadata.projectId;
const numericProjectId = await metadata.numericProjectId;

// Get instance location
const region = await metadata.region;
const zone = await metadata.zone;

// Get service account
const serviceAccount = await metadata.serviceAccountEmail;

// Get instance access token (for authenticating to Google APIs)
const accessToken = await metadata.getAccessToken();
```

### Custom Metadata Server

```typescript
// Use custom metadata server URL
const metadata = new GCloudMetadata('http://custom-metadata-server');

// Fetch custom metadata path
const customValue = await metadata.get('custom/path');
```

## Configuration

### Default Configuration

The module comes with predefined configuration for common metadata:

| Property | Metadata Path | Environment Variable | Regex Parser |
|----------|---------------|---------------------|--------------|
| `projectId` | `computeMetadata/v1/project/project-id` | `GOOGLE_CLOUD_PROJECT` | None |
| `numericProjectId` | `computeMetadata/v1/project/numeric-project-id` | None | None |
| `region` | `computeMetadata/v1/instance/region` | `GOOGLE_CLOUD_REGION` | Extract region from full path |
| `zone` | `computeMetadata/v1/instance/zone` | `GOOGLE_CLOUD_ZONE` | Extract zone from full path |
| `serviceAccountEmail` | `computeMetadata/v1/instance/service-accounts/default/email` | None | None |
| `accessToken`         | `/computeMetadata/v1/instance/service-accounts/default/token` | None                   | None                         |

### Metadata Server URL

The default metadata server URL is `http://metadata.google.internal`, which is the standard Google Cloud metadata service endpoint.

## Environment Variables

### Development Mode

The module automatically detects development environments and uses environment variables when:

- `METADATA_DISABLED` is set (any value)
- `FP8_ENV` starts with `local`

### Supported Environment Variables

- `GOOGLE_CLOUD_PROJECT` - Project ID fallback
- `GOOGLE_CLOUD_REGION` - Region fallback  
- `GOOGLE_CLOUD_ZONE` - Zone fallback
- `METADATA_DISABLED` - Disable metadata server access
- `FP8_ENV` - Environment indicator

### Example Environment Setup

```bash
# For local development
export FP8_ENV=local-dev
export GOOGLE_CLOUD_PROJECT=my-project-id
export GOOGLE_CLOUD_REGION=us-central1
export GOOGLE_CLOUD_ZONE=us-central1-a
```

## API Reference

### GCloudMetadata Class

#### Constructor

```typescript
constructor(baseUrl?: string)
```

**Parameters:**
- `baseUrl` (optional): Custom metadata server URL. Defaults to `http://metadata.google.internal`

#### Properties

##### projectId
```typescript
get projectId(): Promise<string | undefined>
```
Returns the Google Cloud project ID.

##### numericProjectId
```typescript
get numericProjectId(): Promise<string | undefined>
```
Returns the numeric project ID.

##### region
```typescript
get region(): Promise<string | undefined>
```
Returns the instance region (e.g., `us-central1`).

##### zone
```typescript
get zone(): Promise<string | undefined>
```
Returns the instance zone (e.g., `us-central1-a`).

##### serviceAccountEmail
```typescript
get serviceAccountEmail(): Promise<string | undefined>
```
Returns the default service account email.

##### accessToken
```typescript
getAccessToken(): Promise<string | undefined>
```
Fetches an OAuth2 access token for the default service account. Useful for authenticating to Google APIs from within the instance.

#### Methods

##### get()
```typescript
async get(path: string): Promise<string | undefined>
```

Fetch metadata from a custom path on the metadata server.

**Parameters:**
- `path`: The metadata path to fetch (relative to base URL)

**Returns:** Promise resolving to the metadata value or `undefined` if not found

**Example:**
```typescript
const customValue = await metadata.get('computeMetadata/v1/instance/hostname');
```

##### getAccessToken()
```typescript
async getAccessToken(): Promise<string | undefined>
```
Fetches an OAuth2 access token for the default service account from the metadata server.

**Returns:** Promise resolving to the access token string, or `undefined` if not available.

**Example:**
```typescript
const token = await metadata.getAccessToken();
if (token) {
  // Use token to authenticate API requests
}
```

### Caching Behavior

- All metadata values are cached after first fetch
- Cache is automatically cleared if a fetch returns `undefined`
- No cache expiration - values persist for the lifetime of the instance

### Error Handling

The module handles errors gracefully:

1. **Network errors**: Falls back to environment variables when available
2. **Missing metadata**: Returns `undefined` instead of throwing
3. **Invalid responses**: Logs errors and attempts fallback

### Regex Parsing

For region and zone metadata, the module automatically extracts the short name from the full path:

- Input: `projects/123456789/regions/us-central1`
- Output: `us-central1`

## Testing

### Mock Setup

For testing, you can mock the metadata service:

```typescript
import { GCloudMetadata } from '@farport/gcutils/metadata';
import * as helper from '@farport/gcutils/core/helper';

// Mock the fetch function
jest.mock('@farport/gcutils/core/helper', () => ({
    ...jest.requireActual('@farport/gcutils/core/helper'),
    fetch: jest.fn(),
}));

const mockFetch = helper.fetch as jest.MockedFunction<typeof helper.fetch>;

describe('Metadata Tests', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should fetch project ID', async () => {
        mockFetch.mockResolvedValue('test-project');
        
        const metadata = new GCloudMetadata();
        const projectId = await metadata.projectId;
        
        expect(projectId).toBe('test-project');
    });
});
```

### Environment Variable Testing

```typescript
describe('Environment Variable Fallbacks', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should use environment variables in local mode', async () => {
        process.env.FP8_ENV = 'local-dev';
        process.env.GOOGLE_CLOUD_PROJECT = 'local-project';

        const metadata = new GCloudMetadata();
        const projectId = await metadata.projectId;

        expect(projectId).toBe('local-project');
    });
});
```

## Best Practices

1. **Single Instance**: Create one `GCloudMetadata` instance per application to maximize caching benefits
2. **Error Handling**: Always handle the possibility of `undefined` returns
3. **Environment Setup**: Configure appropriate environment variables for local development
4. **Testing**: Mock the metadata service for reliable unit tests

## Examples

### Complete Application Setup

```typescript
import { GCloudMetadata } from '@farport/gcutils/metadata';

class Application {
    private metadata = new GCloudMetadata();
    
    async initialize() {
        // Get essential project information
        const projectId = await this.metadata.projectId;
        const region = await this.metadata.region;
        
        if (!projectId) {
            throw new Error('Unable to determine project ID');
        }
        
        console.log(`Starting application in project: ${projectId}`);
        console.log(`Running in region: ${region || 'unknown'}`);
    }
}
```

### Custom Metadata Access

```typescript
// Access custom metadata
const hostname = await metadata.get('computeMetadata/v1/instance/hostname');
const machineType = await metadata.get('computeMetadata/v1/instance/machine-type');

// Handle custom parsing
const attributes = await metadata.get('computeMetadata/v1/instance/attributes/custom-attribute');
```
