# Cloud Storage Module

The cloud-storage module provides a simple and powerful wrapper around Google Cloud Storage with support for `gs://` style paths. It offers both Promise-based (`BStore`) and RxJS Observable-based (`BStoreRx`) interfaces.

## Table of Contents

- [Authentication](#authentication)
- [Basic Usage](#basic-usage)
- [Classes](#classes)
- [Interfaces and Types](#interfaces-and-types)
- [Utility Functions](#utility-functions)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Authentication

Before using the cloud-storage module, ensure you have Google Cloud authentication set up:

1. Set up Application Default Credentials (ADC)
2. Or set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable
3. Or use service account keys

## Basic Usage

```typescript
import { BStore, BStoreRx } from '@fp8/gcutils/cloud-storage';

// Promise-based interface with default settings
const store = new BStore();

// Promise-based interface with custom error handler
const storeWithErrorHandler = new BStore({
    errorHandler: (error) => {
        console.error('Custom error handler:', error.message);
    }
});

// Promise-based interface with Google Cloud Storage options
const storeWithOptions = new BStore({
    projectId: 'my-project-id',
    keyFilename: '/path/to/service-account.json',
    errorHandler: (error) => {
        console.error('Storage error:', error.message);
    }
});

// RxJS Observable-based interface  
const storeRx = new BStoreRx();

// RxJS Observable-based interface with options
const storeRxWithOptions = new BStoreRx({
    projectId: 'my-project-id',
    errorHandler: (error) => {
        console.error('RxJS store error:', error.message);
    }
});
```

## Classes

### BStore

Promise-based Google Cloud Storage wrapper.

#### Constructor

```typescript
constructor(options?: IBStoreOptions)
```

- `options` (optional): Configuration options including:
  - `errorHandler` (optional): Custom error handler for stream operations
  - Other Google Cloud Storage options (see `StorageOptions`)

#### Methods

##### meta(input: File | IGsUri | string): Promise<TMetaData>

Get metadata for a file.

```typescript
const meta = await store.meta('gs://my-bucket/path/to/file.pdf');
console.log(meta.contentType); // 'application/pdf'
```

##### exists(input: File | IGsUri | string, waitFor?: number, maxRetry?: number): Promise<boolean>

Check if a file exists with retry logic.

```typescript
const fileExists = await store.exists('gs://my-bucket/file.txt', 200, 10);
```

##### read(input: File | IGsUri | string): Promise<Buffer>

Read file contents as a Buffer.

```typescript
const data = await store.read('gs://my-bucket/file.txt');
const content = data.toString('utf8');
```

##### retrieve(input: string): Promise<IRetrieveResult>

Get both metadata and content in a single call.

```typescript
const result = await store.retrieve('gs://my-bucket/file.pdf');
console.log(result.gs.bucket);    // 'my-bucket'
console.log(result.meta);         // metadata object
console.log(result.buffer);       // file content as Buffer
```

##### getFiles(input: IGsUri | string): Promise<File[]>

List files in a directory (excludes directories).

```typescript
const files = await store.getFiles('gs://my-bucket/path/');
files.forEach(file => console.log(file.name));
```

##### processFiles<T>(gspath: IGsUri | string, action: (file: File) => Promise<T>): Promise<T[]>

Process all files in a directory with a custom action.

```typescript
const results = await store.processFiles(
    'gs://my-bucket/images/',
    async (file) => {
        const meta = await file.getMetadata();
        return { name: file.name, size: meta[0].size };
    }
);
```

##### deleteFiles(gspath: IGsUri | string): Promise<void>

Delete all files in a directory.

```typescript
await store.deleteFiles('gs://my-bucket/temp/');
```

#### Stream Methods

##### createReadableStream(gspath: File | IGsUri | string): Readable

Create a readable stream for a file.

```typescript
const readStream = store.createReadableStream('gs://my-bucket/large-file.csv');
readStream.pipe(process.stdout);
```

##### createWriteableStream(gspath: File | IGsUri | string, options?: CreateWriteStreamOptions): Writable

Create a writable stream for uploading.

```typescript
const writeStream = store.createWriteableStream('gs://my-bucket/upload.txt');
writeStream.write('Hello, World!');
writeStream.end();
```

### BStoreRx

RxJS Observable-based Google Cloud Storage wrapper. Has the same methods as `BStore` but returns Observables instead of Promises.

```typescript
import { BStoreRx } from '@fp8/gcutils/cloud-storage';

const storeRx = new BStoreRx();

// All methods return Observables
storeRx.meta('gs://my-bucket/file.txt').subscribe(meta => {
    console.log(meta);
});

storeRx.getFiles('gs://my-bucket/path/').subscribe(file => {
    console.log(file.name);
});
```

## Interfaces and Types

### IGsUri

Parsed Google Storage URI components.

```typescript
interface IGsUri {
    bucket: string;      // 'my-bucket'
    path: string;        // 'path/to/file.pdf'
    dirname: string;     // 'path/to'
    filename: string;    // 'file.pdf'
    basename: string;    // 'file'
    extname: string;     // '.pdf'
}
```

### IRetrieveResult

Result from the `retrieve` method.

```typescript
interface IRetrieveResult {
    gs: IGsUri;         // Parsed URI
    meta: TMetaData;    // File metadata
    buffer: Buffer;     // File content
}
```

### TMetaData

File metadata type (key-value pairs).

```typescript
type TMetaData = { [key: string]: unknown };
```

### TErrorCallback

Error handler callback type.

```typescript
type TErrorCallback = (err: Error) => void;
```

### IBStoreOptions

Configuration options for BStore classes.

```typescript
interface IBStoreOptions extends StorageOptions {
    errorHandler?: TErrorCallback;
}
```

This interface extends Google Cloud Storage's `StorageOptions` and adds an optional `errorHandler` property for custom error handling in stream operations.

## Utility Functions

### parseGsPath(gspath: string): IGsUri

Parse a Google Storage path into components.

```typescript
import { parseGsPath } from '@fp8/gcutils/cloud-storage';

const parsed = parseGsPath('gs://my-bucket/path/to/file.pdf');
console.log(parsed.bucket);    // 'my-bucket'
console.log(parsed.dirname);   // 'path/to'
console.log(parsed.filename);  // 'file.pdf'
```

### generateGsUri(bucket: string, filepath: string, dirname?: string): IGsUri

Generate IGsUri from components.

```typescript
import { generateGsUri } from '@fp8/gcutils/cloud-storage';

const gsUri = generateGsUri('my-bucket', 'file.pdf', 'path/to');
console.log(gsUri.path);  // 'path/to/file.pdf'
```

### generateGsPath(gsuri: IGsUri): string

Generate a gs:// path from IGsUri.

```typescript
import { generateGsPath } from '@fp8/gcutils/cloud-storage';

const path = generateGsPath({
    bucket: 'my-bucket',
    path: 'path/to/file.pdf',
    dirname: 'path/to',
    filename: 'file.pdf',
    basename: 'file',
    extname: '.pdf'
});
console.log(path);  // 'gs://my-bucket/path/to/file.pdf'
```

## Examples

### Basic File Operations

```typescript
import { BStore } from '@fp8/gcutils/cloud-storage';

const store = new BStore();

async function basicOperations() {
    const filePath = 'gs://my-bucket/documents/report.pdf';
    
    // Check if file exists
    const exists = await store.exists(filePath);
    if (!exists) {
        console.log('File does not exist');
        return;
    }
    
    // Get file metadata
    const meta = await store.meta(filePath);
    console.log(`File size: ${meta.size} bytes`);
    console.log(`Content type: ${meta.contentType}`);
    
    // Read file content
    const content = await store.read(filePath);
    console.log(`Read ${content.length} bytes`);
    
    // Get everything at once
    const result = await store.retrieve(filePath);
    console.log(`Bucket: ${result.gs.bucket}`);
    console.log(`Path: ${result.gs.path}`);
    console.log(`Size: ${result.buffer.length} bytes`);
}
```

### Directory Operations

```typescript
async function directoryOperations() {
    const dirPath = 'gs://my-bucket/uploads/';
    
    // List all files in directory
    const files = await store.getFiles(dirPath);
    console.log(`Found ${files.length} files`);
    
    // Process each file
    const fileSizes = await store.processFiles(dirPath, async (file) => {
        const [meta] = await file.getMetadata();
        return {
            name: file.name,
            size: meta.size
        };
    });
    
    console.log('File sizes:', fileSizes);
    
    // Delete all files in directory
    await store.deleteFiles('gs://my-bucket/temp/');
}
```

### Stream Operations

```typescript
import * as fs from 'fs';

async function streamOperations() {
    // Upload a file using streams
    const localFile = fs.createReadStream('./local-file.txt');
    const uploadStream = store.createWriteableStream('gs://my-bucket/uploaded.txt');
    
    localFile.pipe(uploadStream);
    
    // Download a file using streams
    const downloadStream = store.createReadableStream('gs://my-bucket/large-file.csv');
    const localOutput = fs.createWriteStream('./downloaded-file.csv');
    
    downloadStream.pipe(localOutput);
}
```

### Using RxJS Interface

```typescript
import { BStoreRx } from '@fp8/gcutils/cloud-storage';
import { map, filter } from 'rxjs/operators';

const storeRx = new BStoreRx();

// Process files with RxJS operators
storeRx.getFiles('gs://my-bucket/images/')
    .pipe(
        filter(file => file.name.endsWith('.jpg')),
        map(file => ({ name: file.name, bucket: file.bucket.name }))
    )
    .subscribe(fileInfo => {
        console.log('JPG file:', fileInfo);
    });

// Chain operations
storeRx.meta('gs://my-bucket/config.json')
    .pipe(
        map(meta => ({ size: meta.size, lastModified: meta.updated }))
    )
    .subscribe(info => {
        console.log('Config file info:', info);
    });
```

## Error Handling

### Custom Error Handler

```typescript
// Option 1: Pass error handler in constructor options
const store = new BStore({ 
    errorHandler: (error: Error) => {
        console.error('Storage operation failed:', error.message);
        // Custom error handling logic
    }
});

// Option 2: Set error handler after construction
const store2 = new BStore();
store2.setErrorHandler((error: Error) => {
    console.error('Storage operation failed:', error.message);
    // Custom error handling logic
});

// Option 3: Combine with other Google Cloud Storage options
const store3 = new BStore({
    projectId: 'my-project-id',
    keyFilename: '/path/to/service-account.json',
    errorHandler: (error: Error) => {
        console.error('Storage operation failed:', error.message);
        // Send to monitoring service
        monitoringService.reportError(error);
    }
});
```

### Error Handling with Streams

```typescript
const readStream = store.createReadableStream('gs://my-bucket/file.txt');

readStream.on('error', (error) => {
    console.error('Read stream error:', error);
});

readStream.on('data', (chunk) => {
    console.log('Received chunk:', chunk.length);
});
```

### Handling Non-existent Files

```typescript
try {
    const meta = await store.meta('gs://my-bucket/non-existent.txt');
} catch (error) {
    if (error.message.includes('No such object')) {
        console.log('File does not exist');
    } else {
        throw error;
    }
}
```

### Using exists() for Safe Operations

```typescript
async function safeFileOperation(filePath: string) {
    // Wait up to 2 seconds (10 retries × 200ms) for file to exist
    const fileExists = await store.exists(filePath, 200, 10);
    
    if (fileExists) {
        const content = await store.read(filePath);
        return content;
    } else {
        throw new Error(`File not found: ${filePath}`);
    }
}
```

## Best Practices

1. **Use error handlers**: Always provide error handlers when working with streams
2. **Check existence**: Use `exists()` before operations on files that might not exist
3. **Path consistency**: Always use `gs://` protocol for path strings
4. **Stream for large files**: Use streams for large file operations to manage memory
5. **Batch operations**: Use `processFiles()` for batch operations on multiple files
6. **Proper cleanup**: Ensure streams are properly closed and cleaned up
