# Pub/Sub

A comprehensive service-oriented interface for Google Cloud Pub/Sub with built-in error handling, JSON message support, and reactive programming patterns.

## Overview

The Pub/Sub module provides three main classes:

- **`PubSubService`** - Main service class for managing topics and subscriptions
- **`Publisher`** - Dedicated class for publishing messages to topics
- **`Subscriber`** - Dedicated class for consuming messages from subscriptions

## Installation & Setup

```typescript
import { PubSubService } from '@farport/gcutils';

const pubsub = new PubSubService({
    projectId: 'your-project-id',
    // Optional: additional Google Cloud PubSub client configuration
});
```

## Key Features

- **Automatic Topic/Subscription Creation** - Creates topics and subscriptions if they don't exist
- **JSON Message Support** - Built-in support for JSON message publishing and consumption
- **Error Handling** - Comprehensive error handling with detailed logging
- **Retry Logic** - Built-in retry mechanisms with configurable settings
- **Type Safety** - Full TypeScript support with proper type definitions
- **Clean Resource Management** - Proper cleanup methods for subscriptions

## Core Classes

### PubSubService

The main service class that provides high-level operations for Pub/Sub.

```typescript
const pubsub = new PubSubService({ projectId: 'my-project' });

// Create or get a topic
const topic = await pubsub.createTopic('my-topic');

// Create or get a subscription
const subscription = await pubsub.createSubscription(topic, 'my-subscription');

// Create a publisher
const publisher = await pubsub.createPublisher('my-topic');

// Create a subscriber
const subscriber = await pubsub.createSubscriber('my-topic', 'my-subscription');
```

### Publisher

Dedicated class for publishing messages to topics with JSON support.

```typescript
const publisher = await pubsub.createPublisher('my-topic');

// Publish JSON data
const messageId = await publisher.publishJson({
    userId: 123,
    action: 'user_created',
    timestamp: Date.now()
});

// Publish raw message
const messageId2 = await publisher.publishMessage({
    data: Buffer.from('Hello World'),
    attributes: { type: 'greeting' }
});
```

### Subscriber

Dedicated class for consuming messages from subscriptions.

```typescript
const subscriber = await pubsub.createSubscriber('my-topic', 'my-subscription');

// Listen for JSON messages
await subscriber.listenJson(
    async (data, message) => {
        console.log('Received JSON:', data);
        message.ack(); // Acknowledge the message
    },
    (error, message) => {
        console.error('Error processing message:', error);
        message?.nack(); // Negative acknowledge
    }
);

// Listen for raw messages
await subscriber.listen(
    async (message) => {
        const text = message.data.toString();
        console.log('Received:', text);
        message.ack();
    }
);

// Clean up when done
await subscriber.close(); // For multi-process usage
// OR
await subscriber.delete(); // For single-process usage (deletes subscription)
```

## Usage Patterns

### Simple Publisher/Subscriber

```typescript
import { PubSubService } from '@farport/gcutils/pubsub';

const pubsub = new PubSubService({ projectId: 'my-project' });

// Publisher
const publisher = await pubsub.createPublisher('events');
await publisher.publishJson({ event: 'user_signup', userId: 123 });

// Subscriber
const subscriber = await pubsub.createSubscriber('events', 'event-processor');
await subscriber.listenJson(async (data, message) => {
    console.log('Processing event:', data);
    // Process the event...
    message.ack();
});
```

### Error Handling

```typescript
const subscriber = await pubsub.createSubscriber('events', 'processor');

await subscriber.listenJson(
    async (data, message) => {
        try {
            await processEvent(data);
            message.ack();
        } catch (error) {
            console.error('Failed to process event:', error);
            message.nack(); // Will retry based on subscription settings
        }
    },
    (error, message) => {
        console.error('Subscription error:', error);
        // Handle subscription-level errors
    }
);
```

### Configuration Options

#### Topic Creation Options

```typescript
const topic = await pubsub.createTopic('my-topic', {
    enableMessageOrdering: true,
    schemaSettings: {
        schema: 'projects/my-project/schemas/my-schema',
        encoding: 'JSON'
    }
});
```

#### Subscription Creation Options

```typescript
const subscription = await pubsub.createSubscription(
    topic,
    'my-subscription',
    {
        ackDeadlineSeconds: 60,
        messageRetentionDuration: '7d',
        enableMessageOrdering: true,
        deadLetterPolicy: {
            deadLetterTopic: 'projects/my-project/topics/dead-letters',
            maxDeliveryAttempts: 5
        }
    }
);
```

#### Publisher Options

```typescript
const publisher = await pubsub.createPublisher('my-topic', {
    enableMessageOrdering: true,
    gaxOpts: {
        timeout: 30000
    }
});

// Publish with custom attributes
await publisher.publishJson(
    { message: 'Hello' },
    {
        attributes: { 
            source: 'my-service',
            version: '1.0'
        },
        orderingKey: 'user-123'
    }
);
```

## Resource Management

### Subscriber Cleanup

```typescript
// For applications with multiple processes accessing the same subscription
await subscriber.close(); // Closes connection but keeps subscription

// For single-process applications
await subscriber.delete(); // Deletes the subscription entirely
```

### Graceful Shutdown

```typescript
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await subscriber.close();
    process.exit(0);
});
```

## Advanced Features

### Message Attributes and Content Types

The Publisher automatically sets `contentType: 'application/json'` for JSON messages:

```typescript
await publisher.publishJson({ data: 'value' });
// Automatically adds: attributes: { contentType: 'application/json' }
```

### Logging Integration

The module integrates with the library's logging system and provides detailed logs:

```typescript
// Logs include subscription names, topic names, message IDs, and error details
// Example log output:
// [PubSubService] Published messageId abc123 with contentType application/json
// [PubSubService] new subscription created: projects/my-project/subscriptions/my-sub
```

### Custom Error Handlers

```typescript
const customErrorHandler = (error: Error, message?: Message) => {
    // Custom error handling logic
    console.error(`Custom handler: ${error.message}`);
    if (message) {
        // Decide whether to ack or nack based on error type
        if (error.message.includes('permanent')) {
            message.ack(); // Don't retry permanent errors
        } else {
            message.nack(); // Retry transient errors
        }
    }
};

await subscriber.listen(messageHandler, customErrorHandler);
```

## Type Definitions

### Key Interfaces

```typescript
interface IPubSubServiceSettings extends ClientConfig {
    projectId: string;
    createEntityCallback?: TCreateEntityCallback;
}

interface IPubSubLoggerPayload {
    subscriptionName?: string;
    topicName?: string;
    messageId?: string;
    messageContentType?: string;
    messageAckId?: string;
    grpcErrorStatus?: number;
    grpcErrorMetadata?: IJson;
    grpcErrorDetails?: string;
}

type TPublishOptions = Omit<MessageOptions, 'data' | 'json'>;
```

## Best Practices

1. **Use JSON Messages** - Use `publishJson()` and `listenJson()` for structured data
2. **Implement Proper Error Handling** - Always provide error handlers for subscribers
3. **Resource Cleanup** - Always call `close()` or `delete()` when shutting down
4. **Message Acknowledgment** - Always acknowledge messages after successful processing
5. **Retry Logic** - Use `nack()` for transient errors, `ack()` for permanent failures
6. **Monitoring** - Leverage the built-in logging for monitoring and debugging

## Authentication

Ensure you have Google Cloud authentication set up before using the Pub/Sub service:

```bash
# Application Default Credentials (recommended)
gcloud auth application-default login

# Or set service account key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

## Common Patterns

### Event-Driven Architecture

```typescript
// Event publisher service
class EventPublisher {
    private publisher: Publisher;

    async init() {
        const pubsub = new PubSubService({ projectId: 'my-project' });
        this.publisher = await pubsub.createPublisher('domain-events');
    }

    async publishUserCreated(userId: string) {
        await this.publisher.publishJson({
            eventType: 'UserCreated',
            userId,
            timestamp: new Date().toISOString()
        });
    }
}

// Event consumer service
class EventConsumer {
    async init() {
        const pubsub = new PubSubService({ projectId: 'my-project' });
        const subscriber = await pubsub.createSubscriber('domain-events', 'user-service');
        
        await subscriber.listenJson(async (event, message) => {
            switch (event.eventType) {
                case 'UserCreated':
                    await this.handleUserCreated(event);
                    break;
                // Handle other events...
            }
            message.ack();
        });
    }
}
```

This Pub/Sub module provides a robust foundation for building event-driven applications with Google Cloud Pub/Sub, offering both simplicity for basic use cases and flexibility for advanced scenarios.
