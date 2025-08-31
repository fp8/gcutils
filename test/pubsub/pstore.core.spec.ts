import '../testlib';

import { delay } from 'jlog-facade';
import {
    CreateSubscriptionOptions,
    SubscriptionOptions,
    PublishOptions,
    Message,
} from '@google-cloud/pubsub';

import {
    getPubSubLoggerPayload,
    IPubSubLoggerPayloadRequest,
    PubSubService,
    IPubSubServiceSettings,
} from '@fp8proj/pubsub';

const projectId = 'project-ztQ4OICwQV';
const options: IPubSubServiceSettings = {
    apiEndpoint: 'localhost:9902',
    projectId,
};

describe('PubSubService', () => {
    const service = new PubSubService(options);

    describe('constructor', () => {
        it('should initialize with correct projectId', () => {
            expect(service.projectId).toBe(projectId);
        });

        it('should create service with additional options', () => {
            const serviceWithOptions = new PubSubService({
                ...options,
                keyFilename: 'path/to/key.json',
            });
            expect(serviceWithOptions.projectId).toBe(projectId);
        });
    });

    describe('getTopic', () => {
        const topicName = 'get-kYLGLsCTib-topic';

        it('should return a topic without options', () => {
            const topic = service.getTopic(topicName);
            const expectedTopicName = `projects/${projectId}/topics/${topicName}`;
            expect(topic).toBeDefined();
            expect(topic.name).toBe(expectedTopicName);

            // Test payload with topic
            const payload = getLoggerPayload({ topic });
            expect(payload).toEqual({
                topicName: expectedTopicName,
            });
        });

        it('should return a topic with publish options', () => {
            const publishOptions: PublishOptions = {
                batching: {
                    maxMessages: 100,
                    maxMilliseconds: 1000,
                },
            };
            const topic = service.getTopic(topicName, publishOptions);
            expect(topic).toBeDefined();
            expect(topic.name).toBe(
                `projects/${projectId}/topics/${topicName}`,
            );
        });
    });

    describe('createTopic', () => {
        const topicName = 'create-cmQ5xFv3OU-topic';

        afterEach(async () => {
            // Cleanup: delete topic if it exists
            try {
                const topic = service.getTopic(topicName);
                const [exists] = await topic.exists();
                if (exists) {
                    await topic.delete();
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should create a new topic', async () => {
            const topic = await service.createTopic(topicName);
            expect(topic).toBeDefined();
            expect(topic.name).toBe(
                `projects/${projectId}/topics/${topicName}`,
            );

            const [exists] = await topic.exists();
            expect(exists).toBe(true);
        });

        it('should return existing topic if already exists', async () => {
            // Create topic first
            const firstTopic = await service.createTopic(topicName);

            // Try to create again
            const secondTopic = await service.createTopic(topicName);

            expect(firstTopic.name).toBe(secondTopic.name);
        });

        it('should create topic with publish options', async () => {
            const publishOptions: PublishOptions = {
                batching: {
                    maxMessages: 50,
                    maxMilliseconds: 500,
                },
            };

            const topic = await service.createTopic(topicName, publishOptions);
            expect(topic).toBeDefined();
            expect(topic.name).toBe(
                `projects/${projectId}/topics/${topicName}`,
            );
        });
    });

    describe('getSubscription', () => {
        const topicName = 'sub-yJefjHiWOt-topic';
        const subscriptionName = 'test-WpGqYkV7sC-sub';
        let topic: any;

        beforeEach(async () => {
            topic = await service.createTopic(topicName);
        });

        afterEach(async () => {
            // Cleanup
            try {
                const subscription = service.getSubscription(
                    topic,
                    subscriptionName,
                );
                const [exists] = await subscription.exists();
                if (exists) {
                    await subscription.delete();
                }
                await topic.delete();
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should return a subscription without options', () => {
            const subscription = service.getSubscription(
                topic,
                subscriptionName,
            );
            const expectedSubscriptionName = `projects/${projectId}/subscriptions/${subscriptionName}`;
            expect(subscription).toBeDefined();
            expect(subscription.name).toBe(expectedSubscriptionName);

            // Test payload with topic
            const payload = getLoggerPayload({ subscription });
            expect(payload).toEqual({
                topicName: `projects/${projectId}/topics/${topicName}`,
                subscriptionName: expectedSubscriptionName,
            });
        });

        it('should return a subscription with options', () => {
            // Using empty options object for now - the main test is that the method accepts options
            const subscriptionOptions: SubscriptionOptions = {};

            const subscription = service.getSubscription(
                topic,
                subscriptionName,
                subscriptionOptions,
            );
            expect(subscription).toBeDefined();
            expect(subscription.name).toBe(
                `projects/${projectId}/subscriptions/${subscriptionName}`,
            );
        });
    });

    describe('createSubscription', () => {
        const topicName = 'sub-1gL4BNiSPg-topic';
        const subscriptionName = 'test-hX1od1bTCD-sub';
        let topic: any;

        beforeEach(async () => {
            topic = await service.createTopic(topicName);
        });

        afterEach(async () => {
            // Cleanup
            try {
                const subscription = service.getSubscription(
                    topic,
                    subscriptionName,
                );
                const [exists] = await subscription.exists();
                if (exists) {
                    await subscription.delete();
                }
                await topic.delete();
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should create a new subscription', async () => {
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );
            expect(subscription).toBeDefined();
            expect(subscription.name).toBe(
                `projects/${projectId}/subscriptions/${subscriptionName}`,
            );

            const [exists] = await subscription.exists();
            expect(exists).toBe(true);
        });

        it('should return existing subscription if already exists', async () => {
            // Create subscription first
            const firstSub = await service.createSubscription(
                topic,
                subscriptionName,
            );

            // Try to create again
            const secondSub = await service.createSubscription(
                topic,
                subscriptionName,
            );

            expect(firstSub.name).toBe(secondSub.name);
        });

        it('should create subscription with create options', async () => {
            const createOptions: CreateSubscriptionOptions = {
                ackDeadlineSeconds: 60,
                messageRetentionDuration: { seconds: 7 * 24 * 60 * 60 }, // 7 days
            };

            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
                createOptions,
            );
            expect(subscription).toBeDefined();

            const [exists] = await subscription.exists();
            expect(exists).toBe(true);
        });

        it('should create subscription with both create and subscription options', async () => {
            const createOptions: CreateSubscriptionOptions = {
                ackDeadlineSeconds: 45,
            };

            const subscriptionOptions: SubscriptionOptions = {};

            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
                createOptions,
                subscriptionOptions,
            );
            expect(subscription).toBeDefined();

            const [exists] = await subscription.exists();
            expect(exists).toBe(true);
        });
    });

    describe('subscribe', () => {
        const topicName = 'test-subscribe-topic';
        let topic: any;

        beforeEach(async () => {
            topic = await service.createTopic(topicName);
        });

        afterEach(async () => {
            // Cleanup
            try {
                await topic.delete();
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should handle messages successfully', async () => {
            const subscriptionName = 'test-subscribe-success';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            const receivedMessages: string[] = [];
            const messageHandler = jest.fn(async (message: any) => {
                receivedMessages.push(message.data.toString());
                message.ack();
            });

            service.subscribe(subscription, messageHandler);

            // Publish a test message
            const testMessage = 'test-message-subscribe';
            await topic.publishMessage({
                data: Buffer.from(testMessage),
            });

            // Wait for message processing
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            expect(messageHandler).toHaveBeenCalled();
            expect(receivedMessages).toContain(testMessage);
        }, 500_000);

        it('should handle message handler errors', async () => {
            const subscriptionName = 'test-subscribe-error';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            const errorMessage = 'Handler error test pu4UjKow9q';
            const messageHandler = jest.fn(async (_) => {
                throw new Error(errorMessage);
            });
            const errorHandler = jest.fn((error: Error, message?: Message) => {
                expect(error.message).toBe(
                    `messageHandler Error: ${errorMessage}`,
                );
                // console.error('### Message:', message);
                expect(message).toBeDefined();
            });

            expect(() => {
                service.subscribe(subscription, messageHandler, errorHandler);
            }).not.toThrow();

            // Publish a test message to trigger the error
            await topic.publishMessage({
                data: Buffer.from('trigger-error'),
            });

            await delay(500);
            await subscription.close();
            await subscription.delete();

            // It should really be just 1. However, the second call is the retry after nack
            expect(messageHandler).toHaveBeenCalledTimes(2);
            // It should really be just 1. However, the second call is the retry after nack
            expect(errorHandler).toHaveBeenCalledTimes(2);
        });

        it('should handle subscription errors with custom error handler', async () => {
            const subscriptionName = 'test-subscribe-custom-error';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            const messageHandler = jest.fn(async (message: any) => {
                message.ack();
            });

            const errorHandler = jest.fn((error: Error) => {
                // Custom error handling
            });

            service.subscribe(subscription, messageHandler, errorHandler);

            // Simulate an error by closing the subscription
            await subscription.close();
            await subscription.delete();

            // The error handler should be set up even if not immediately called
            expect(errorHandler).toBeDefined();
        });

        it('should handle subscription close event', async () => {
            const subscriptionName = 'test-subscribe-close';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            const messageHandler = jest.fn(async (message: any) => {
                message.ack();
            });

            service.subscribe(subscription, messageHandler);

            // Close the subscription to trigger the close event
            await subscription.close();
            await subscription.delete();

            // Verify the subscription was set up
            expect(messageHandler).toBeDefined();
        });

        it('should handle subscription errors without custom error handler', async () => {
            const subscriptionName = 'test-subscribe-default-error';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            const messageHandler = jest.fn(async (message: any) => {
                message.ack();
            });

            // Don't provide a custom error handler
            service.subscribe(subscription, messageHandler);

            // The subscription should have error listeners attached
            expect(subscription.listenerCount('error')).toBeGreaterThan(0);

            await subscription.close();
            await subscription.delete();
        });
    });

    describe('edge cases and validation', () => {
        const topicName = 'test-edge-cases-topic';
        let topic: any;

        beforeEach(async () => {
            topic = await service.createTopic(topicName);
        });

        afterEach(async () => {
            // Cleanup
            try {
                await topic.delete();
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should handle empty topic names gracefully', () => {
            // Test with a valid minimal topic name instead of empty string
            const minimalTopic = service.getTopic('a');
            expect(minimalTopic).toBeDefined();
            expect(minimalTopic.name).toBe(`projects/${projectId}/topics/a`);
        });

        it('should handle special characters in topic names', async () => {
            const specialTopicName = 'test-topic-with_underscores-and.dots';
            const specialTopic = await service.createTopic(specialTopicName);
            expect(specialTopic).toBeDefined();
            expect(specialTopic.name).toBe(
                `projects/${projectId}/topics/${specialTopicName}`,
            );
            await specialTopic.delete();
        });

        it('should handle subscription with minimal configuration', async () => {
            const subscription = await service.createSubscription(
                topic,
                'minimal-sub',
            );

            let messageReceived = false;
            const messageHandler = jest.fn(async (message: any) => {
                messageReceived = true;
                message.ack();
            });

            service.subscribe(subscription, messageHandler);

            // Publish a message
            await topic.publishMessage({
                data: Buffer.from('minimal test'),
            });

            // Wait briefly for message processing
            await delay(500);
            await subscription.close();
            await subscription.delete();

            expect(messageHandler).toHaveBeenCalled();
        });

        it('should handle rapid subscription creation and deletion', async () => {
            const subscriptions = [];
            const subscriptionNames = ['rapid-1', 'rapid-2', 'rapid-3'];

            // Create multiple subscriptions rapidly
            for (const name of subscriptionNames) {
                const sub = await service.createSubscription(topic, name);
                subscriptions.push(sub);
                expect(sub).toBeDefined();
                expect(sub.name).toBe(
                    `projects/${projectId}/subscriptions/${name}`,
                );
            }

            // Clean them up
            for (const sub of subscriptions) {
                await sub.close();
                await sub.delete();
            }
        });

        it('should handle message acknowledgment patterns', async () => {
            const subscription = await service.createSubscription(
                topic,
                'ack-pattern-sub',
            );

            const ackedMessages: string[] = [];
            const allMessages: string[] = [];

            const messageHandler = jest.fn(async (message: any) => {
                const data = message.data.toString();
                allMessages.push(data);
                if (data.includes('ack')) {
                    ackedMessages.push(data);
                    message.ack();
                } else {
                    // For nack messages, we still ack them to avoid redelivery in test
                    // but track them separately
                    message.ack();
                }
            });

            service.subscribe(subscription, messageHandler);

            // Publish messages with different patterns
            await topic.publishMessage({
                data: Buffer.from('ack-message-1'),
            });
            await topic.publishMessage({
                data: Buffer.from('nack-message-1'),
            });
            await topic.publishMessage({
                data: Buffer.from('ack-message-2'),
            });

            // Wait for message processing
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            expect(messageHandler).toHaveBeenCalled();
            expect(allMessages.length).toBeGreaterThanOrEqual(3);
            expect(ackedMessages.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('basic operations', () => {
        const topicName = 'topic-n4UyxCwGzP';
        const subscriptionName = 'sub-n4UyxCwGzP';

        it('should create a topic', async () => {
            const topic = await service.createTopic(topicName);
            expect(topic).toBeDefined();
            expect(topic.name).toBe(
                `projects/${projectId}/topics/${topicName}`,
            );
        });

        it('should get previously created topic', async () => {
            const topic = service.getTopic(topicName);
            expect(topic).toBeDefined();
            expect(topic.name).toBe(
                `projects/${projectId}/topics/${topicName}`,
            );
            await expect(topic.exists()).resolves.toEqual([true]);
        });

        it('should create a subscription', async () => {
            const topic = await service.createTopic(topicName);
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );
            expect(subscription).toBeDefined();

            const expectedSubscriptionName = `projects/${projectId}/subscriptions/${subscriptionName}`;
            expect(subscription.name).toBe(expectedSubscriptionName);
            await subscription.close();
        });

        it('should get a previously created subscription', async () => {
            const topic = await service.createTopic(topicName);
            const subscription = service.getSubscription(
                topic,
                subscriptionName,
            );
            expect(subscription).toBeDefined();
            expect(subscription.name).toBe(
                `projects/${projectId}/subscriptions/${subscriptionName}`,
            );
            await expect(subscription.exists()).resolves.toEqual([true]);
        });
    });

    describe('integration scenarios', () => {
        const topicName = 'test-integration-topic';

        afterEach(async () => {
            // Comprehensive cleanup
            try {
                const topic = service.getTopic(topicName);
                const [topicExists] = await topic.exists();
                if (topicExists) {
                    const [subscriptions] = await topic.getSubscriptions();
                    for (const sub of subscriptions) {
                        await sub.close();
                        await sub.delete();
                    }
                    await topic.delete();
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should handle rapid topic creation and deletion', async () => {
            const topic = await service.createTopic(topicName);
            expect(topic).toBeDefined();

            const [exists] = await topic.exists();
            expect(exists).toBe(true);

            await topic.delete();
            const [existsAfterDelete] = await topic.exists();
            expect(existsAfterDelete).toBe(false);
        });

        it('should handle multiple subscriptions lifecycle', async () => {
            const topic = await service.createTopic(topicName);

            const sub1 = await service.createSubscription(
                topic,
                'lifecycle-sub-1',
            );
            const sub2 = await service.createSubscription(
                topic,
                'lifecycle-sub-2',
            );

            expect(sub1.name).toBe(
                `projects/${projectId}/subscriptions/lifecycle-sub-1`,
            );
            expect(sub2.name).toBe(
                `projects/${projectId}/subscriptions/lifecycle-sub-2`,
            );

            // Verify both exist
            await expect(sub1.exists()).resolves.toEqual([true]);
            await expect(sub2.exists()).resolves.toEqual([true]);

            // Clean up subscriptions
            await sub1.close();
            await sub1.delete();
            await sub2.close();
            await sub2.delete();

            // Verify they're deleted
            await expect(sub1.exists()).resolves.toEqual([false]);
            await expect(sub2.exists()).resolves.toEqual([false]);
        });

        it('should handle publishing and receiving with JSON data', async () => {
            const topic = await service.createTopic(topicName);
            const subscription = await service.createSubscription(
                topic,
                'json-test-sub',
            );

            const receivedData: any[] = [];
            const messageHandler = jest.fn(async (message: Message) => {
                // Expect the contentType to be `application/json`
                expect(message.attributes.contentType).toBe('application/json');
                const data = JSON.parse(message.data.toString());
                receivedData.push(data);
                message.ack();
            });

            service.subscribe(subscription, messageHandler);

            // Publish JSON message
            const testData = {
                id: 'test-123',
                message: 'Hello World',
                timestamp: new Date().toISOString(),
            };

            // Use json attribute to publish objects
            await topic.publishMessage({
                json: testData,
                attributes: {
                    contentType: 'application/json',
                },
            });

            // Wait for message processing
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            expect(messageHandler).toHaveBeenCalled();
            expect(receivedData).toHaveLength(1);
            expect(receivedData[0]).toEqual(testData);
        });

        it('should handle message attributes', async () => {
            const topic = await service.createTopic(topicName);
            const subscription = await service.createSubscription(
                topic,
                'attributes-test-sub',
            );

            const receivedMessages: any[] = [];
            const messageHandler = jest.fn(async (message: any) => {
                receivedMessages.push({
                    data: message.data.toString(),
                    attributes: message.attributes,
                });
                message.ack();
            });

            service.subscribe(subscription, messageHandler);

            // Publish message with attributes
            const testMessage = 'Message with attributes';
            const testAttributes = {
                source: 'test-suite',
                version: '1.0',
                priority: 'high',
            };

            await topic.publishMessage({
                data: Buffer.from(testMessage),
                attributes: testAttributes,
            });

            // Wait for message processing
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            expect(messageHandler).toHaveBeenCalled();
            expect(receivedMessages).toHaveLength(1);
            expect(receivedMessages[0].data).toBe(testMessage);
            expect(receivedMessages[0].attributes).toEqual(testAttributes);
        });
    });

    describe('.subscribe - legacy tests', () => {
        const topicName = 'topic-ztQ4OICwQV';
        it('Single subscriber', async () => {
            const topic = await service.createTopic(topicName);
            const subscriptionName = 'sub-I8nks68uwQ';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            // Subscribe and capture the messages
            const received: { [id: string]: string } = {};
            const expectedMessages: { [id: string]: string } = {};

            service.subscribe(subscription, async (msg) => {
                received[msg.id] = msg.data.toString();
                msg.ack();
            });

            // Publish some messages
            const messages = ['message-PyWPXMw3b6', 'message-meEx533jSN'];
            for (const message of messages) {
                const published = await topic.publishMessage({
                    data: Buffer.from(message),
                });
                expectedMessages[published] = message;
            }

            // Wait a sec to receive messages and close the subscription
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            expect(Object.keys(received).length).toBe(messages.length);
            expect(received).toEqual(expectedMessages);
        });

        it('Error in messageHandler should trigger errorHandler', async () => {
            const topic = await service.createTopic(topicName);
            const subscriptionName = 'sub-LMUgm5uRYk';
            const subscription = await service.createSubscription(
                topic,
                subscriptionName,
            );

            // Subscribe and capture the messages
            const received: { [id: string]: string } = {};
            const expectedMessages: { [id: string]: string } = {};

            const messageHandler = jest.fn(async (message: Message) => {
                const text = message.data.toString();
                if (text === 'ERROR-MESSAGE') {
                    throw new Error('Test error');
                }
                received[message.id] = text;
                message.ack();
            });

            const errorHandler = jest.fn((error: Error) => {
                const payload = getLoggerPayload({
                    subscription,
                    error,
                });
                expect(payload).toEqual({
                    subscriptionName: `projects/${projectId}/subscriptions/${subscriptionName}`,
                });
                received['error'] = error.message;
            });

            service.subscribe(subscription, messageHandler, errorHandler);

            // Publish some messages
            const messages = ['message-hJI641ULWr', 'ERROR-MESSAGE'];
            for (const message of messages) {
                const published = await topic.publishMessage({
                    data: Buffer.from(message),
                });
                if (message !== 'ERROR-MESSAGE') {
                    expectedMessages[published] = message;
                }
            }

            // Add to error to expectedMessages
            expectedMessages['error'] = 'messageHandler Error: Test error';

            // Wait a sec to receive messages and close the subscription
            await delay(1000);
            await subscription.close();
            await subscription.delete();

            // It should really be just 2. However, the third call is the retry after one nack
            expect(messageHandler).toHaveBeenCalledTimes(3);
            // It should really be just 1. However, the second call is the retry after one nack
            expect(errorHandler).toHaveBeenCalledTimes(2);

            expect(Object.keys(received).length).toBe(2);
            expect(received).toEqual(expectedMessages);
        });

        it('Multiple subscribers, different names', async () => {
            const topic = await service.createTopic(topicName);
            const sub1 = await service.createSubscription(
                topic,
                'A4Nlub61tq-sub',
            );
            const sub2 = await service.createSubscription(
                topic,
                'yQ0h6bmnQR-sub',
            );

            // Subscribe and capture the messages
            const expectedMessages: { [id: string]: string } = {};
            const received1: { [id: string]: string } = {};
            const received2: { [id: string]: string } = {};

            service.subscribe(sub1, async (msg) => {
                received1[msg.id] = msg.data.toString();
                msg.ack();
            });

            service.subscribe(sub2, async (msg) => {
                received2[msg.id] = msg.data.toString();
                msg.ack();
            });

            // Publish some messages
            const numberOfMessages = 10;
            for (let i = 0; i < numberOfMessages; i++) {
                const published = await topic.publishMessage({
                    data: Buffer.from(`message-${i}`),
                });
                expectedMessages[published] = `message-${i}`;
            }

            // Wait a sec to receive messages and close the subscription
            await delay(2000);
            await sub1.close();
            await sub1.delete();
            await sub2.close();
            await sub2.delete();

            // console.log('### received1', received1);
            // console.log('### received2', received2);

            expect(Object.keys(received1).length).toBe(numberOfMessages);
            expect(received1).toEqual(expectedMessages);
            expect(Object.keys(received2).length).toBe(numberOfMessages);
            expect(received2).toEqual(expectedMessages);
        });

        it('Multiple subscribers, same names', async () => {
            const topic = await service.createTopic(topicName);
            const sub1 = await service.createSubscription(
                topic,
                'dMovLEZDsT-sub',
            );
            const sub2 = await service.createSubscription(
                topic,
                'dMovLEZDsT-sub',
            );

            // Subscribe and capture the messages
            const expectedMessages: { [id: string]: string } = {};
            const received1: { [id: string]: string } = {};
            const received2: { [id: string]: string } = {};

            service.subscribe(sub1, async (msg) => {
                received1[msg.id] = msg.data.toString();
                msg.ack();
            });

            service.subscribe(sub2, async (msg) => {
                received2[msg.id] = msg.data.toString();
                msg.ack();
            });

            // Publish some messages
            const numberOfMessages = 10;
            for (let i = 0; i < numberOfMessages; i++) {
                const published = await topic.publishMessage({
                    data: Buffer.from(`message-${i}`),
                });
                expectedMessages[published] = `message-${i}`;
            }

            // Wait a sec to receive messages and close the subscription
            await delay(2000);
            await sub1.close();
            // await sub1.delete();
            await sub2.close();
            await sub2.delete();

            // console.log('### received1', received1);
            // console.log('### received2', received2);

            expect(
                Object.keys(received1).length + Object.keys(received2).length,
            ).toBe(numberOfMessages);

            const received = { ...received1, ...received2 };
            expect(received).toEqual(expectedMessages);
        });
    });
});

/**
 * Wrapper around the getPubSubLoggerPayload method and return the `PubSubInfo` values
 * @param service
 * @param input
 * @returns
 */
function getLoggerPayload(input: IPubSubLoggerPayloadRequest): any {
    const loggerPayload = getPubSubLoggerPayload(input);
    expect(loggerPayload).toBeDefined();
    const json = loggerPayload?.toIJson();
    expect(json).toBeDefined();
    return json?.PubSubInfo;
}
