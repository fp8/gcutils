# Firestore Module Documentation

The Firestore module provides a class-driven interface for Google Cloud Firestore operations with built-in validation, type safety, and namespace support.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Creating Models](#creating-models)
- [Basic Operations](#basic-operations)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Testing](#testing)

## Overview

The Firestore module abstracts Google Cloud Firestore operations through:

- **Type-safe models** extending `AbstractBaseFirebaseModel`
- **Automatic validation** using class-validator decorators
- **Namespace support** for multi-tenant applications
- **Promise-based API** for async operations
- **Query capabilities** with filtering and field selection

## Core Components

### AbstractBaseFirebaseModel

Base class for all Firestore documents providing:
- Automatic key management
- Validation methods
- Data transformation utilities
- Collection name management

### FirestoreService

Main service class implementing the `IFirestorePromise` interface with methods for:
- Document CRUD operations
- Collection queries
- Batch operations
- Collection management

### FirestoreServiceSettings

Configuration interface extending Google Cloud Firestore Settings with:
- Namespace configuration
- Custom entity creation callbacks
- Connection settings

## Getting Started

### Basic Setup

```typescript
import { FirestoreService } from '@farport/gcutils/firestore';

// Basic initialization
const firestore = new FirestoreService();

// With configuration
const firestore = new FirestoreService({
  projectId: 'your-project-id',
  namespace: 'your-namespace', // Optional
  ignoreUndefinedProperties: true
});
```

### Creating a Model

```typescript
import { AbstractBaseFirebaseModel } from '@farport/gcutils/firestore';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class User extends AbstractBaseFirebaseModel {
  @IsOptional()
  @IsString()
  declare key?: string;

  @IsString()
  @MinLength(2)
  declare name: string;

  @IsEmail()
  declare email: string;

  @Type(() => Date)
  declare createdAt: Date;

  @Type(() => Date)
  declare updatedAt: Date;

  // Static factory method
  public static create(data: Partial<User>): User {
    const user = new User();
    Object.assign(user, data);
    user.createdAt = user.createdAt || new Date();
    user.updatedAt = new Date();
    return user;
  }
}
```

## Configuration

### Namespace Support

Namespaces allow you to organize collections in a hierarchical structure:

```typescript
const firestore = new FirestoreService({
  namespace: 'tenant-123'
});

// Collections will be created under: ns/tenant-123/{collectionName}
```

### Custom Entity Creation

Override default entity creation with custom logic:

```typescript
const customCreateEntity = <T>(
  type: { new (): T },
  data: unknown,
  options?: ValidateModelOptions
): T => {
  // Custom creation logic
  return createEntityAndValidate(type, data, options);
};

const firestore = new FirestoreService({
  createEntityCallback: customCreateEntity
});
```

## Creating Models

### Model Definition

All models must extend `AbstractBaseFirebaseModel`:

```typescript
export class Product extends AbstractBaseFirebaseModel {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsNumber()
  @Min(0)
  declare price: number;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsArray()
  @IsString({ each: true })
  declare tags: string[];

  // Override collection name if different from class name
  override getCollectionName(): string {
    return 'products'; // Instead of 'Product'
  }
}
```

### Validation Decorators

Use class-validator decorators for automatic validation:

- `@IsString()`, `@IsNumber()`, `@IsBoolean()`
- `@IsEmail()`, `@IsUrl()`, `@IsUUID()`
- `@MinLength()`, `@MaxLength()`, `@Min()`, `@Max()`
- `@IsOptional()` for optional fields
- `@IsArray()` with `{ each: true }` for arrays

### Data Transformation

Use class-transformer decorators for data conversion:

```typescript
export class Event extends AbstractBaseFirebaseModel {
  @Transform(({ value }) => new Date(value), { toClassOnly: true })
  declare eventDate: Date;

  @Expose({ groups: ['view'] })
  get formattedDate(): string {
    return this.eventDate.toLocaleDateString();
  }
}
```

## Basic Operations

### Creating Documents

```typescript
// Create with auto-generated ID
const user = User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

const docRef = await firestore.set(user);
console.log('Created document:', docRef.id);

// Create with specific ID
user.key = 'user-123';
const docRef2 = await firestore.set(user);
```

### Reading Documents

```typescript
// Get by ID
const user = await firestore.get(User, 'user-123');
if (user) {
  console.log('User:', user.name);
}

// Get by document path
const user2 = await firestore.getByPath(
  User, 
  'users/user-123'
);
```

### Updating Documents

```typescript
// Load, modify, and save
const user = await firestore.get(User, 'user-123');
if (user) {
  user.name = 'Jane Doe';
  user.updatedAt = new Date();
  await firestore.set(user);
}
```

### Deleting Documents

```typescript
await firestore.delete(User, 'user-123');
```

## Advanced Features

### Querying Collections

```typescript
import { Filter } from '@google-cloud/firestore';

// Query with filters
const activeUsersFilter = Filter.where('active', '==', true);
const ageFilter = Filter.where('age', '>', 18);
const combinedFilter = Filter.and(activeUsersFilter, ageFilter);

for await (const user of firestore.query(User, combinedFilter)) {
  console.log('Active user:', user.name);
}

// Query with field selection
const nameEmailFields = ['name', 'email'];
for await (const user of firestore.query(User, undefined, nameEmailFields)) {
  console.log('Limited fields:', user.name, user.email);
}
```

### Collection Management

```typescript
// List all collections
const collections = await firestore.listAllCollections();
collections.forEach(collection => {
  console.log('Collection:', collection.path);
});

// Get collection reference
const usersCollection = firestore.getCollectionFromType(User);
```

### Batch Operations

```typescript
// Using setByPath for specific collection paths
await firestore.setByPath('custom-collection', user);
```

### Data Serialization

```typescript
const user = new User();
user.name = 'John';
user.email = 'john@example.com';

// Convert to plain object (for Firestore)
const plainData = user.toPlain();

// Convert to view object (includes computed fields)
const viewData = user.toView();
```

### Validation

```typescript
const user = new User();
user.name = 'Jo'; // Too short, will fail validation

try {
  user.validate();
} catch (error) {
  console.error('Validation failed:', error);
}

// Skip validation when retrieving from Firestore
const user2 = await firestore.get(User, 'user-123', true); // true = skip validation
```

## API Reference

### FirestoreService Methods

#### `set<T>(instance: T): Promise<DocumentReference>`
Save a model instance to Firestore.

#### `setByPath<T>(collectionPath: string, instance: T): Promise<DocumentReference>`
Save to a specific collection path.

#### `get<T>(type: Constructor<T>, key: string, toSkipValidation?: boolean): Promise<T | undefined>`
Retrieve a document by ID.

#### `getByPath<T>(type: Constructor<T>, documentPath: string, toValidate?: boolean): Promise<T | undefined>`
Retrieve a document by path.

#### `query<T>(type: Constructor<T>, filter?: Filter, fieldPaths?: Array<string | FieldPath>): AsyncGenerator<T>`
Query a collection with optional filtering and field selection.

#### `delete<T>(type: Constructor<T>, key: string): Promise<void>`
Delete a document by ID.

#### `listAllCollections(): Promise<CollectionReference[]>`
List all collections in the database or namespace.

### AbstractBaseFirebaseModel Methods

#### `validate(options?: ValidateModelOptions): void`
Validate the instance using class-validator.

#### `toPlain(): unknown`
Convert to plain JavaScript object for storage.

#### `toView(): unknown`
Convert to view object including computed fields.

#### `getCollectionName(): string`
Get the collection name (defaults to class name).

## Testing

### Setting Up Tests

The module includes Firebase emulator support for testing:

```bash
# Start Firestore emulator
yarn fb-emulator:up

# Run tests
yarn test

# Stop emulator
yarn fb-emulator:down
```

### Test Example

```typescript
import { FirestoreService } from '@farport/gcutils/firestore';

describe('User operations', () => {
  let firestore: FirestoreService;

  beforeEach(() => {
    firestore = new FirestoreService({
      host: '127.0.0.1:9901', // Emulator
      ssl: false
    });
  });

  it('should create and retrieve user', async () => {
    const user = User.create({
      name: 'Test User',
      email: 'test@example.com'
    });

    const docRef = await firestore.set(user);
    const retrieved = await firestore.get(User, docRef.id);

    expect(retrieved).toBeInstanceOf(User);
    expect(retrieved?.name).toBe('Test User');
  });
});
```

## Error Handling

```typescript
try {
  const user = await firestore.get(User, 'non-existent');
  // Returns undefined for non-existent documents
} catch (error) {
  console.error('Firestore error:', error);
}

// Validation errors
try {
  const invalidUser = new User();
  invalidUser.validate();
} catch (validationErrors) {
  console.error('Validation failed:', validationErrors);
}
```

## Best Practices

1. **Always validate models** before saving to Firestore
2. **Use static factory methods** for consistent object creation
3. **Implement proper error handling** for network and validation errors
4. **Use namespaces** for multi-tenant applications
5. **Optimize queries** with appropriate filters and field selection
6. **Test with the Firestore emulator** during development
7. **Use TypeScript** for better type safety and development experience

## Migration Guide

When upgrading from direct Firestore usage:

1. Create model classes extending `AbstractBaseFirebaseModel`
2. Add validation decorators to properties
3. Replace direct Firestore calls with `FirestoreService` methods
4. Update queries to use the new query interface
5. Test thoroughly with the emulator

This documentation covers the core functionality of the Firestore module. For specific use cases or advanced configurations, refer to the source code and test files.
