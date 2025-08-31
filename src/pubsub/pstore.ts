import {
    Message,
    Subscription,
    CreateSubscriptionOptions,
    SubscriptionOptions,
    PublishOptions,
    Topic,
} from '@google-cloud/pubsub';

import { createLogger, createError } from '../core';
import {
    AbstractPubSub,
    generateCallOptions,
    generateCreateSubscriptionOptions,
    setupSubscriptionWithHandlers,
    TPublishOptions,
    getPubSubLoggerPayload,
} from './base';
import { MessageOptions } from '@google-cloud/pubsub/build/src/topic';

const logger = createLogger('PubSubService');
const CONTENT_TYPE_JSON = 'application/json';

/**
 * JSON message handler type for processing messages
 */
export type TJsonMessageHandler<T> = (t: T, message: Message) => Promise<void>;

/**
 * Publisher class for managing Pub/Sub topic publishing
 */
export class Publisher {
    #topic: Topic;

    constructor(topic: Topic) {
        this.#topic = topic;
    }

    /**
     * Publish a JSON message to the topic making sure that contentType attributes is set
     * to application/json
     *
     * @param data The JSON data to publish
     * @param options Optional publish options
     * @returns The message ID of the published message
     */
    public async publishJson<T>(
        data: T,
        options?: TPublishOptions,
    ): Promise<string> {
        // Ensure that options exists
        if (!options) {
            options = {
                attributes: {},
            };
        }

        if (!options.attributes) {
            options.attributes = {};
        }

        // Force the contentType attribute to application/json
        options.attributes.contentType = CONTENT_TYPE_JSON;

        // Create option for publishMessage
        const opt: MessageOptions = { json: data, ...options };
        return this.#topic.publishMessage(opt);
    }

    /**
     * Passthrough call for publishing message
     *
     * @param data
     * @returns
     */
    public async publishMessage(data: MessageOptions): Promise<string> {
        const messageId = await this.#topic.publishMessage(data);
        const contentType = data.attributes?.contentType;
        if (contentType) {
            logger.info(
                `Published messageId ${messageId} with contentType ${contentType}`,
            );
        } else {
            logger.info(`Published messageId ${messageId}`);
        }
        return messageId;
    }
}

/**
 * Create a subscriber for a Pub/Sub subscription. Upon the exit of the process,
 * the clean up depends on the usage:
 *
 * - onetime:  If a only a single process will access the subscription, call .delete()
 * - multiuse: If multiple processes will access the subscription, call .close() instead
 */
export class Subscriber {
    #subscriberClosed = false;
    /*
    Intentionally not exposing the subscription object.  It should be managed by Subscriber.
    One can always call .getSubscription() to retrieve it.
    */
    #subscription: Subscription;

    constructor(subscription: Subscription) {
        this.#subscription = subscription;
    }

    /**
     * Listen for messages on the subscription
     *
     * @param messageHandler
     * @param errorHandler
     */
    public async listen(
        messageHandler: (message: Message) => Promise<void>,
        errorHandler?: (error: Error, message?: Message) => void,
    ): Promise<void> {
        // Make sure that .close() has not been called
        if (this.#subscriberClosed) {
            throw new Error(`Subscriber ${this.#subscription.name} is closed`);
        }
        // Make sure that subscription exists
        const [subExists] = await this.#subscription.exists();
        if (!subExists) {
            throw new Error(
                `Subscriber ${this.#subscription.name} does not exist`,
            );
        }
        // Setup handlers
        setupSubscriptionWithHandlers(
            this.#subscription,
            messageHandler,
            errorHandler,
        );
    }

    /**
     * Listen for JSON messages on the subscription.  Designed to be used with
     * Publisher.publishJsonMessage(...)
     *
     * @param messageHandler The message handler function
     * @param errorHandler The error handler function
     */
    public async listenJson<T>(
        messageHandler: TJsonMessageHandler<T>,
        errorHandler?: (error: Error, message?: Message) => void,
    ): Promise<void> {
        const jsonMessageHandler = (message: Message): Promise<void> => {
            const text = message.data.toString();
            const contentType = message.attributes?.contentType;
            const loggerPayload = getPubSubLoggerPayload({
                subscription: this.#subscription,
                message,
            });

            if (contentType !== CONTENT_TYPE_JSON) {
                logger.warn(
                    `Message id ${message.id} does not have json contentType`,
                    loggerPayload,
                );
            }

            try {
                const json = JSON.parse(text) as T;
                return messageHandler(json, message);
            } catch (err) {
                const error = createError(
                    `Failed to parse JSON from messageId ${message.id}:`,
                    err,
                );
                logger.error(error.message, error, loggerPayload);
                return Promise.reject(error);
            }
        };
        await this.listen(jsonMessageHandler, errorHandler);
    }

    /**
     * Close and clean up the subscription. Once closed the current instance
     * of subscriber is no longer usable and new subscribers must be created.
     */
    public async close(): Promise<void> {
        this.#subscription.removeAllListeners();
        await this.#subscription.close();
        this.#subscriberClosed = true;
    }

    /**
     * Delete and close the subscription.
     *
     * Please note that delete is not immediate and it takes a few minutes for subscription
     * to be deleted.  If there are multiple processes listening to the delete subscriber,
     * they will continue to receive message until it's deleted.
     *
     * Do not call .delete if you plan to have multiple process listening on the same subscription.
     */
    public async delete(): Promise<void> {
        if (!this.#subscriberClosed) {
            await this.close();
        }
        const [subExists] = await this.#subscription.exists();
        if (subExists) {
            await this.#subscription.delete();
        }
    }
}

/**
 * A simple wrapper for commonly used PubSub operations
 */
export class PubSubService extends AbstractPubSub {
    /**
     * Get an existing topic or create a new one.
     *
     * @param topicName
     * @param options
     * @returns
     */
    public async createTopic(
        topicName: string,
        options?: PublishOptions,
    ): Promise<Topic> {
        const topic = this.getTopic(topicName, options);
        const [topicExists] = await topic.exists();
        if (topicExists) {
            logger.info(`[PubSubService] topic already exists: ${topic.name}`);
            return topic;
        } else {
            const [newTopic] = await this.client.createTopic(
                topicName,
                generateCallOptions(options?.gaxOpts),
            );
            logger.info(`[PubSubService] new topic created: ${newTopic.name}`);
            if (options) {
                newTopic.setPublishOptions(options);
            }
            return newTopic;
        }
    }

    /**
     * This create a new subscription if it doesn't exist.
     *
     * @param topic
     * @param subscriptionName
     * @param options Used to create a subscription
     * @param subscriptionOptions Used to get a subscription
     * @returns
     */
    public async createSubscription(
        topic: Topic,
        subscriptionName: string,
        options?: CreateSubscriptionOptions,
        subscriptionOptions?: SubscriptionOptions,
    ): Promise<Subscription> {
        // Check subscription
        logger.debug(
            `[PubSubService] Creating subscription: ${subscriptionName} for topic: ${topic.name}`,
        );
        const sub = this.getSubscription(
            topic,
            subscriptionName,
            subscriptionOptions,
        );
        const [subExists] = await sub.exists();
        if (subExists) {
            logger.info(
                `[PubSubService] subscription already exists: ${sub.name}`,
            );
            return sub;
        } else {
            const createOpts = generateCreateSubscriptionOptions(options);
            const [newSub] = await topic.createSubscription(
                subscriptionName,
                createOpts,
            );
            logger.info(
                `[PubSubService] new subscription created: ${newSub.name}`,
            );
            if (subscriptionOptions) {
                newSub.setOptions(subscriptionOptions);
            }
            return newSub;
        }
    }

    /**
     * Subscribe to a Pub/Sub subscription
     *
     * @param subscription The subscription to listen to
     * @param messageHandler The handler for incoming messages
     * @param errorHandler The handler for errors
     */
    public subscribe(
        subscription: Subscription,
        messageHandler: (message: Message) => Promise<void>,
        errorHandler?: (error: Error, message?: Message) => void,
    ): void {
        setupSubscriptionWithHandlers(
            subscription,
            messageHandler,
            errorHandler,
        );
    }

    /**
     * Return a publisher object
     *
     * @param topic
     * @param options
     * @returns
     */
    public async createPublisher(
        topic: string | Topic,
        options?: PublishOptions,
    ): Promise<Publisher> {
        const topicToUse =
            typeof topic === 'string'
                ? await this.createTopic(topic, options)
                : topic;
        return new Publisher(topicToUse);
    }

    /**
     * Return a subscriber object
     *
     * @param topic
     * @param subscriptionName
     * @param options
     * @param topicOptions
     * @returns
     */
    public async createSubscriber(
        topic: string | Topic,
        subscriptionName: string,
        options?: CreateSubscriptionOptions,
        topicOptions?: PublishOptions,
    ): Promise<Subscriber> {
        const topicToUse =
            typeof topic === 'string'
                ? await this.createTopic(topic, topicOptions)
                : topic;
        const subscription = await this.createSubscription(
            topicToUse,
            subscriptionName,
            options,
        );
        return new Subscriber(subscription);
    }
}
