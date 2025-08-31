# Google Cloud Developer Utilities

A comprehensive TypeScript library providing utilities and abstractions for Google Cloud Platform services including Cloud Storage, Firestore, Secret Manager, and metadata access.

## Installation

```bash
npm install @fp8/gcutils
```

**Requirements:**

- Node.js >=20
- Google Cloud authentication (see [Authentication](#authentication))

## Authentication

Before using any modules, ensure you have Google Cloud authentication set up:

1. **Application Default Credentials (Recommended):**

   ```bash
   gcloud auth application-default login
   ```

2. **Service Account Keys:**

   Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of your service account key file.

3. **Environment Variables:**

   For local development, you can use environment variable fallbacks (see individual module documentation).

## Components Overview

### Cloud Storage
Powerful wrapper around Google Cloud Storage with support for `gs://` style paths.

- **`BStore`** - Promise-based interface for Cloud Storage operations
- **`BStoreRx`** - RxJS Observable-based interface for reactive programming
- **Features:** Automatic path parsing, streaming support, metadata handling

📖 **[Detailed Documentation](./docs/cloud-storage.md)**

### Firestore
Class-driven interface for Google Cloud Firestore with built-in validation and type safety.

- **`FirestoreService`** - Promise-based Firestore operations
- **`AbstractBaseFirebaseModel`** - Base class for type-safe document models
- **Features:** Automatic validation, namespace support, query capabilities, multi-tenant applications

📖 **[Detailed Documentation](./docs/firestore.md)**

### Secret Manager
Service-oriented interface for Google Cloud Secret Manager with caching and version management.

- **`SecretsService`** - Promise-based secret management with async factory pattern
- **Features:** In-memory caching, version management, bulk secret loading, error handling with defaults

📖 **[Detailed Documentation](./docs/secret-manager.md)**

### Pub/Sub
Service-oriented interface for Google Cloud Pub/Sub with built-in error handling and JSON message support.

- **`PubSubService`** - Main service class for managing topics and subscriptions
- **`Publisher`** - Dedicated class for publishing messages with JSON support
- **`Subscriber`** - Dedicated class for consuming messages with automatic error handling
- **Features:** Automatic topic/subscription creation, JSON message support, retry logic, clean resource management

📖 **[Detailed Documentation](./docs/pubsub.md)**

### Metadata
Easy access to Google Cloud Metadata server for instance and project information.

- **`GCloudMetadata`** - Cached access to Google Cloud metadata
- **Features:** Automatic caching, environment variable fallbacks, type-safe property access

📖 **[Detailed Documentation](./docs/metadata.md)**

## Quick Start

```typescript
// Cloud Storage
import { BStore, BStoreRx } from '@fp8/gcutils/cloud-storage';
const store = new BStore();

// Firestore
import { FirestoreService } from '@fp8/gcutils/firestore';
const firestore = new FirestoreService({ projectId: 'your-project' });

// Pub/Sub
import { PubSubService } from '@fp8/gcutils/pubsub';
const pubsub = new PubSubService({ projectId: 'your-project' });

// Secret Manager
import { SecretsService } from '@fp8/gcutils/secret-manager';
const secrets = await SecretsService.create({ projectId: 'your-project' });

// Metadata
import { GCloudMetadata } from '@fp8/gcutils/metadata';
const metadata = new GCloudMetadata();
```

## Running Tests

**Prerequisites:**
- Make sure that a google cloud project is activated using gcloud
- You must create a `.env.local` with required test env variables
- Ensure that files in the `test/data` is in a bucket `gs://<GCUTILS_TEST_BUCKET>/public/` directory
- Start emulators by running `yarn emulators:up`

**Content of .env.local**:
```bash
GCUTILS_GOOGLE_CLOUD_PROJECT="<Google Project Name>"
GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER="<Google Project Number>"
GCUTILS_TEST_BUCKET="<Google Cloud Storage Bucket Name>"
GCUTILS_METADATA_PROXY_URL="<Secure Cloud Run URL that proxy to the metadata.google.internal host>"
```

You can easily skip the `test/metadata/mdata-proxy.spec.ts` test if you do not have a `GCUTILS_METADATA_PROXY_URL`

**Run Tests:**
```bash
# Run all tests with coverage
yarn test

# Run tests that exits upon first failure
yarn utest

# Run library tests
yarn test:lib
```

**Stop Emulators:**
```bash
yarn emulators:down
```

## Development

**Build the library:**
```bash
yarn build
```

**Lint and format:**
```bash
yarn lint
```

**Generate documentation:**
```bash
yarn gendoc
```

**Clean build artifacts:**
```bash
yarn clean
```
