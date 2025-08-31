import { testLogger } from '../testlib';

import { delay, IJson } from 'jlog-facade';
import {
    CreateSubscriptionOptions,
    PublishOptions,
    Message,
    Topic,
} from '@google-cloud/pubsub';

import {
    PubSubService,
    IPubSubServiceSettings,
    Publisher,
    Subscriber,
} from '@fp8proj/pubsub';

const projectId = 'test-publisher-subscriber-project';
const options: IPubSubServiceSettings = {
    apiEndpoint: 'localhost:9902',
    projectId,
};

describe('PubSubService - Publisher and Subscriber', () => {
    const service = new PubSubService(options);

    describe('createPublisher', () => {
        const topicName = 'test-publisher-topic';

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

        it('should create a publisher with string topic name', async () => {
            const publisher = await service.createPublisher(topicName);
            expect(publisher).toBeDefined();
            expect(publisher).toBeInstanceOf(Publisher);

            // Verify the topic was created
            const topic = service.getTopic(topicName);
            const [exists] = await topic.exists();
            expect(exists).toBe(true);
        });

        it('should create a publisher with existing topic object', async () => {
            const topic = await service.createTopic(topicName);
            const publisher = await service.createPublisher(topic);
            expect(publisher).toBeDefined();
            expect(publisher).toBeInstanceOf(Publisher);
        });

        it('should create a publisher with publish options', async () => {
            const publishOptions: PublishOptions = {
                batching: {
                    maxMessages: 50,
                    maxMilliseconds: 1000,
                },
            };

            const publisher = await service.createPublisher(
                topicName,
                publishOptions,
            );
            expect(publisher).toBeDefined();
            expect(publisher).toBeInstanceOf(Publisher);
        });

        describe('Publisher functionality', () => {
            let publisher: Publisher;

            beforeEach(async () => {
                publisher = await service.createPublisher(topicName);
            });

            it('should publish JSON messages', async () => {
                const testData: IJson = {
                    message: 'test-json-message',
                    timestamp: Date.now(),
                };

                const messageId = await publisher.publishJson(testData);
                expect(messageId).toBeDefined();
                expect(typeof messageId).toBe('string');
            });

            it('should publish JSON messages with custom attributes', async () => {
                const testData: IJson = {
                    message: 'test-json-with-attributes',
                };

                const messageId = await publisher.publishJson(testData, {
                    attributes: {
                        customAttr: 'customValue',
                    },
                });
                expect(messageId).toBeDefined();
                expect(typeof messageId).toBe('string');
            });

            it('should publish regular messages', async () => {
                const testMessage = 'test-regular-message';
                const messageId = await publisher.publishMessage({
                    data: Buffer.from(testMessage),
                    attributes: {
                        type: 'test',
                    },
                });
                expect(messageId).toBeDefined();
                expect(typeof messageId).toBe('string');
            });
        });
    });

    describe('createSubscriber', () => {
        const topicName = 'test-subscriber-topic';
        const subscriptionName = 'test-subscriber-sub';

        afterEach(async () => {
            // Cleanup: delete subscription and topic if they exist
            try {
                const topic = service.getTopic(topicName);
                const subscription = service.getSubscription(
                    topic,
                    subscriptionName,
                );
                const [subExists] = await subscription.exists();
                if (subExists) {
                    await subscription.close();
                    await subscription.delete();
                }
                const [topicExists] = await topic.exists();
                if (topicExists) {
                    await topic.delete();
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should create a subscriber with string topic name', async () => {
            const subscriber = await service.createSubscriber(
                topicName,
                subscriptionName,
            );
            expect(subscriber).toBeDefined();
            expect(subscriber).toBeInstanceOf(Subscriber);

            // Verify the topic and subscription were created
            const topic = service.getTopic(topicName);
            const [topicExists] = await topic.exists();
            expect(topicExists).toBe(true);

            const subscription = service.getSubscription(
                topic,
                subscriptionName,
            );
            const [subExists] = await subscription.exists();
            expect(subExists).toBe(true);
        });

        it('should create a subscriber with existing topic object', async () => {
            const topic = await service.createTopic(topicName);
            const subscriber = await service.createSubscriber(
                topic,
                subscriptionName,
            );
            expect(subscriber).toBeDefined();
            expect(subscriber).toBeInstanceOf(Subscriber);
        });

        it('Subscriber close should delete subscription and can be re-created', async () => {
            const subscriptionNameLocal = 'YIchH4Ueid-sub';
            const topic = await service.createTopic(topicName);
            const subscriber = await service.createSubscriber(
                topic,
                subscriptionNameLocal,
            );

            // Make sure subscription exists
            const subscription = service.getSubscription(
                topic,
                subscriptionNameLocal,
            );
            await expect(subscription.exists()).resolves.toEqual([true]);

            await subscriber.delete();
            await delay(500);

            // Subscription should no longer exist
            await expect(subscription.exists()).resolves.toEqual([false]);

            // Try to re-create the subscriber
            const newSubscriber = await service.createSubscriber(
                topic,
                subscriptionNameLocal,
            );
            expect(newSubscriber).toBeDefined();
            expect(newSubscriber).toBeInstanceOf(Subscriber);
            await expect(subscription.exists()).resolves.toEqual([true]);
        });

        it('should create a subscriber with create subscription options', async () => {
            const createOptions: CreateSubscriptionOptions = {
                ackDeadlineSeconds: 30,
                messageRetentionDuration: { seconds: 3 * 24 * 60 * 60 }, // 3 days
            };

            const subscriber = await service.createSubscriber(
                topicName,
                subscriptionName,
                createOptions,
            );
            expect(subscriber).toBeDefined();
            expect(subscriber).toBeInstanceOf(Subscriber);
        });

        it('should create a subscriber with both create options and topic options', async () => {
            const createOptions: CreateSubscriptionOptions = {
                ackDeadlineSeconds: 45,
            };

            const topicOptions: PublishOptions = {
                batching: {
                    maxMessages: 25,
                    maxMilliseconds: 500,
                },
            };

            const subscriber = await service.createSubscriber(
                topicName,
                subscriptionName,
                createOptions,
                topicOptions,
            );
            expect(subscriber).toBeDefined();
            expect(subscriber).toBeInstanceOf(Subscriber);
        });

        describe('Subscriber functionality', () => {
            let subscriber: Subscriber;
            let publisher: Publisher;

            beforeEach(async () => {
                publisher = await service.createPublisher(topicName);
                subscriber = await service.createSubscriber(
                    topicName,
                    subscriptionName,
                );
            });

            it('should listen for messages', async () => {
                const receivedMessages: string[] = [];
                const messageHandler = jest.fn(async (message: Message) => {
                    receivedMessages.push(message.data.toString());
                    message.ack();
                });

                await subscriber.listen(messageHandler);

                // Small delay to ensure subscription is ready
                await delay(100);

                // Publish a test message
                const testMessage = 'test-subscriber-message';
                await publisher.publishMessage({
                    data: Buffer.from(testMessage),
                });

                // Wait for message processing
                await delay(1000);
                await subscriber.close();

                expect(messageHandler).toHaveBeenCalled();
                expect(receivedMessages).toContain(testMessage);
            });

            it('should listen for JSON messages', async () => {
                const receivedData: IJson[] = [];
                const messageHandler = jest.fn(
                    async (data: IJson, message: Message) => {
                        receivedData.push(data);
                        message.ack();
                    },
                );

                await subscriber.listenJson(messageHandler);

                // Small delay to ensure subscription is ready
                await delay(100);

                // Publish a JSON test message
                const testData: IJson = {
                    type: 'test',
                    content: 'json-subscriber-test',
                    timestamp: Date.now(),
                };
                await publisher.publishJson(testData);

                // Wait for message processing
                await delay(1000);
                await subscriber.close();

                expect(messageHandler).toHaveBeenCalled();
                expect(receivedData).toHaveLength(1);
                expect(receivedData[0]).toEqual(testData);
            });

            it('should handle JSON parsing errors gracefully', async () => {
                const messageHandler = jest.fn(
                    async (data: IJson, message: Message) => {
                        message.ack();
                    },
                );

                const errorHandler = jest.fn(
                    (error: Error, message?: Message) => {
                        expect(error.message).toContain('Failed to parse JSON');
                    },
                );

                await subscriber.listenJson(messageHandler, errorHandler);

                // Small delay to ensure subscription is ready
                await delay(100);

                // Publish invalid JSON
                await publisher.publishMessage({
                    data: Buffer.from('invalid-json-{'),
                    attributes: {
                        contentType: 'application/json',
                    },
                });

                // Wait for message processing
                await delay(1000);
                await subscriber.close();

                expect(messageHandler).not.toHaveBeenCalled();
                expect(errorHandler).toHaveBeenCalled();
            });

            it('should handle errors in message handler', async () => {
                const errorMessage = 'Test handler error';
                const messageHandler = jest.fn(async (message: Message) => {
                    throw new Error(errorMessage);
                });

                const errorHandler = jest.fn(
                    (error: Error, message?: Message) => {
                        expect(error.message).toContain(errorMessage);
                    },
                );

                await subscriber.listen(messageHandler, errorHandler);

                // Small delay to ensure subscription is ready
                await delay(100);

                // Publish a test message
                await publisher.publishMessage({
                    data: Buffer.from('error-trigger-message'),
                });

                // Wait for message processing
                await delay(1000);
                await subscriber.close();

                expect(messageHandler).toHaveBeenCalled();
                expect(errorHandler).toHaveBeenCalled();
            });

            it('should properly close subscriber', async () => {
                const messageHandler = jest.fn(async (message: Message) => {
                    message.ack();
                });

                await subscriber.listen(messageHandler);

                // Close should not throw
                await expect(subscriber.close()).resolves.not.toThrow();
            });
        });
    });

    describe('Publisher and Subscriber integration', () => {
        const topicName = 'test-integration-topic';
        const subscriptionName = 'test-integration-sub';

        afterEach(async () => {
            // Cleanup
            try {
                const topic = service.getTopic(topicName);
                const subscription = service.getSubscription(
                    topic,
                    subscriptionName,
                );
                const [subExists] = await subscription.exists();
                if (subExists) {
                    await subscription.close();
                    await subscription.delete();
                }
                const [topicExists] = await topic.exists();
                if (topicExists) {
                    await topic.delete();
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        it('should handle end-to-end JSON message flow', async () => {
            const publisher = await service.createPublisher(topicName);
            const subscriber = await service.createSubscriber(
                topicName,
                subscriptionName,
            );

            const receivedData: IJson[] = [];
            const messageHandler = jest.fn(
                async (data: IJson, message: Message) => {
                    receivedData.push(data);
                    message.ack();
                },
            );

            await subscriber.listenJson(messageHandler);

            // Small delay to ensure subscription is ready
            await delay(100);

            // Publish multiple JSON messages
            const testMessages: IJson[] = [
                { id: 1, message: 'first message' },
                { id: 2, message: 'second message' },
                { id: 3, message: 'third message' },
            ];

            for (const msg of testMessages) {
                await publisher.publishJson(msg);
            }

            // Wait for message processing
            await delay(1000);
            await subscriber.close();

            expect(messageHandler).toHaveBeenCalledTimes(testMessages.length);
            expect(receivedData).toHaveLength(testMessages.length);

            // Verify all messages were received
            testMessages.forEach((testMsg) => {
                expect(receivedData).toContainEqual(testMsg);
            });
        });

        it('should handle mixed message types', async () => {
            const publisher = await service.createPublisher(topicName);
            const subscriber = await service.createSubscriber(
                topicName,
                subscriptionName,
            );

            const receivedMessages: any[] = [];
            const messageHandler = jest.fn(async (message: Message) => {
                receivedMessages.push({
                    data: message.data.toString(),
                    attributes: message.attributes,
                });
                message.ack();
            });

            await subscriber.listen(messageHandler);

            // Small delay to ensure subscription is ready
            await delay(100);

            // Publish JSON message
            await publisher.publishJson({
                type: 'json',
                content: 'json content',
            });

            // Publish regular message
            await publisher.publishMessage({
                data: Buffer.from('regular message'),
                attributes: { type: 'regular' },
            });

            // Wait for message processing
            await delay(1000);
            await subscriber.close();

            expect(messageHandler).toHaveBeenCalledTimes(2);
            expect(receivedMessages).toHaveLength(2);

            // Check JSON message
            const jsonMessage = receivedMessages.find(
                (m) => m.attributes.contentType === 'application/json',
            );
            expect(jsonMessage).toBeDefined();
            expect(JSON.parse(jsonMessage.data)).toEqual({
                type: 'json',
                content: 'json content',
            });

            // Check regular message
            const regularMessage = receivedMessages.find(
                (m) => m.attributes.type === 'regular',
            );
            expect(regularMessage).toBeDefined();
            expect(regularMessage.data).toBe('regular message');
        });

        it('Subscriber close should stop listening for messages', async () => {
            const topicNameLocal = 'bV3aMVBPVc-topic';
            const topic = await service.createTopic(topicNameLocal);
            const publisher = await service.createPublisher(topic);

            const subscriptionNameLocal = 'bV3aMVBPVc-sub';
            // await drainMessage(service, topic, subscriptionNameLocal);

            const subscriber = await service.createSubscriber(
                topic,
                subscriptionNameLocal,
            );

            const receivedData: IJson[] = [];
            const messageHandler = jest.fn(
                async (data: IJson, message: Message) => {
                    receivedData.push(data);
                    message.ack();
                },
            );

            await subscriber.listenJson(messageHandler);

            // Small delay to ensure subscription is ready
            await delay(100);

            // Publish multiple JSON messages
            const testMessages: IJson[] = [
                { id: 1, message: 'first message' },
                { id: 2, message: 'second message' },
            ];

            for (const msg of testMessages) {
                await publisher.publishJson(msg);
            }

            // Wait for message processing
            await delay(1000);
            await subscriber.delete();
            await delay(500);

            // Publish another message
            await publisher.publishJson({ id: 3, message: 'third message' });
            await delay(500);

            expect(messageHandler).toHaveBeenCalledTimes(testMessages.length);
            expect(receivedData).toHaveLength(testMessages.length);

            // Verify all messages were received
            testMessages.forEach((testMsg) => {
                expect(receivedData).toContainEqual(testMsg);
            });
        });
    });
});

async function drainMessage(
    service: PubSubService,
    topic: Topic,
    subscriptionName: string,
): Promise<void> {
    const subscription = service.getSubscription(topic, subscriptionName);

    let messageCount = 0;
    const messageHandler = jest.fn(async (message: Message) => {
        testLogger.warn(`Message id: ${message.id} drained`);
        message.ack();
        messageCount += 1;
    });

    service.subscribe(subscription, messageHandler);

    let prevMessageCount = -1;

    while (prevMessageCount !== messageCount) {
        prevMessageCount = messageCount;
        testLogger.debug(`Drained messages: ${messageCount}`);
        await delay(500);
    }

    testLogger.warn('All message drained');
    subscription.removeAllListeners();
    await subscription.close();
    await subscription.delete();
}
