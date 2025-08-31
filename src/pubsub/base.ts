import { IJson, KV, safeStringify } from 'jlog-facade';
import {
    CallOptions,
    ClientConfig,
    CreateSubscriptionOptions,
    DebugMessage,
    Duration,
    Message,
    PubSub,
    StatusError,
    Subscription,
    SubscriptionOptions,
    Topic,
} from '@google-cloud/pubsub';
import {
    MessageOptions,
    PublishOptions,
} from '@google-cloud/pubsub/build/src/topic';

import { createError, createLogger, TCreateEntityCallback } from '../core';

const logger = createLogger('pstore.base');

/**
 * PubSub logger payload creation entries
 */
export interface IPubSubLoggerPayloadRequest {
    topic?: Topic;
    subscription?: Subscription;
    message?: Message;
    messageId?: string; // Used when full Message is not available
    error?: Error;
}

/**
 * PubSub logger payload
 */
export interface IPubSubLoggerPayload extends IJson {
    subscriptionName?: string;
    topicName?: string;
    messageId?: string;
    messageContentType?: string;
    messageAckId?: string;
    grpcErrorStatus?: number;
    grpcErrorMetadata?: IJson;
    grpcErrorDetails?: string;
}

/**
 * Create a KV loggable for PubSub logger payload
 *
 * @param input
 * @returns
 */
export function getPubSubLoggerPayload(
    input: IPubSubLoggerPayloadRequest,
): KV<IPubSubLoggerPayload> {
    const payload: IPubSubLoggerPayload = {};

    // Add subscription
    const sub = input.subscription;
    if (sub) payload.subscriptionName = sub.name;

    // Add topic, giving priority to the topic from subscription
    if (sub) {
        const topicName =
            typeof sub.topic === 'string' ? sub.topic : sub.topic?.name;
        if (topicName) payload.topicName = topicName;
    } else if (input.topic) {
        payload.topicName =
            typeof input.topic === 'string' ? input.topic : input.topic?.name;
    }

    // Add message ID
    if (input.message) {
        payload.messageId = input.message.id;
        const contentType = input.message.attributes?.contentType;
        if (contentType) payload.messageContentType = contentType;
        if (input.message.ackId) payload.messageAckId = input.message.ackId;
    } else if (input.messageId) {
        payload.messageId = input.messageId;
    }

    // Add StatusError details (don't add actual error message as error itself should be part of the log)
    const error = input.error;
    if (error instanceof StatusError) {
        payload.grpcErrorStatus = error.code;
        payload.grpcErrorMetadata = JSON.parse(
            safeStringify(error.metadata.toJSON()),
        );
        payload.grpcErrorDetails = error.details;
    }

    return KV.of('PubSubInfo', payload);
}

/**
 * Create the default options for a new topic.
 * - Add grpc retry logic
 *
 * @param options
 * @returns
 */
export function generateCallOptions(options?: CallOptions): CallOptions {
    const result: CallOptions = options ? { ...options } : {};

    /**
     * Publish Message default retry settings for Topic creation
     *
     * ref: https://cloud.google.com/pubsub/docs/retry-requests#retry_a_message_request
     */
    const publishRetrySetting = {
        retryCodes: [
            10, // 'ABORTED'
            1, // 'CANCELLED',
            4, // 'DEADLINE_EXCEEDED'
            13, // 'INTERNAL'
            8, // 'RESOURCE_EXHAUSTED'
            14, // 'UNAVAILABLE'
            2, // 'UNKNOWN'
        ],
        backoffSettings: {
            // The initial delay time, in milliseconds, between the completion
            // of the first failed request and the initiation of the first retrying request.
            initialRetryDelayMillis: 100,
            // The multiplier by which to increase the delay time between the completion
            // of failed requests, and the initiation of the subsequent retrying request.
            retryDelayMultiplier: 4,
            // The maximum delay time, in milliseconds, between requests.
            // When this value is reached, retryDelayMultiplier will no longer be used to increase delay time.
            maxRetryDelayMillis: 60000,
            // The initial timeout parameter to the request.
            initialRpcTimeoutMillis: 60000,
            // The multiplier by which to increase the timeout parameter between failed requests.
            rpcTimeoutMultiplier: 1.0,
            // The maximum timeout parameter, in milliseconds, for a request. When this value is reached,
            // rpcTimeoutMultiplier will no longer be used to increase the timeout.
            maxRpcTimeoutMillis: 60000,
            // The total time, in milliseconds, starting from when the initial request is sent,
            // after which an error will be returned, regardless of the retrying attempts made meanwhile.
            totalTimeoutMillis: 600000,
        },
    };

    // Set the retry options
    if (!result.retry) {
        result.retry = publishRetrySetting;
    }

    return result;
}

/**
 * Create the default options for a new subscription.
 *
 * @param options
 * @returns
 */
export function generateCreateSubscriptionOptions(
    options?: CreateSubscriptionOptions,
): CreateSubscriptionOptions {
    const result: CreateSubscriptionOptions = options ? { ...options } : {};

    // Set default ack deadline
    if (!result.retryPolicy) {
        result.retryPolicy = {
            minimumBackoff: Duration.from({ seconds: 1 }),
            maximumBackoff: Duration.from({ seconds: 60 }),
        };
    }

    // Set default gaxOpts for grpc retry
    if (!result.gaxOpts) {
        result.gaxOpts = generateCallOptions(result.gaxOpts);
    }

    return result;
}

/**
 * Setup subscription with message and error handlers
 *
 * @param subscription
 * @param messageHandler
 * @param errorHandler
 */
export function setupSubscriptionWithHandlers(
    subscription: Subscription,
    messageHandler: (message: Message) => Promise<void>,
    errorHandler?: (error: Error, message?: Message) => void,
): void {
    const errHandler =
        errorHandler ??
        ((error, message) => {
            const loggerPayload = getPubSubLoggerPayload({
                subscription,
                message,
                error,
            });
            if (loggerPayload) {
                if (message) {
                    // If message passed, expect the message to come from the messageHandler
                    logger.error(
                        `[PubSubService] ${error.message}`,
                        error,
                        loggerPayload,
                    );
                } else {
                    logger.error(
                        `[PubSubService] subscribe error: ${error.message}`,
                        error,
                        loggerPayload,
                    );
                }
            } else {
                // This shouldn't happen as loggerPayload will always be populated with at least the subscription info
                logger.error(
                    `[PubSubService] subscribe error: ${error.message}`,
                    error,
                );
            }
        });

    subscription.on('message', async (message: Message) => {
        try {
            await messageHandler(message);
            // if message processed successfully, ack
            message.ack();
        } catch (err) {
            // nack the message on failure
            message.nack();
            // Ending the message with `:` the original error message will be appended
            const error = createError('messageHandler Error:', err);
            // throwing error here is not caught anywhere.  Passing the error to errorHandler instead
            errHandler(error, message);
        }
    });

    // Error here would be a StatusError
    subscription.on('error', errHandler);

    subscription.on('debug', (msg: DebugMessage) => {
        logger.debug(
            `[PubSubService] debug for subscription: ${subscription.name}: ${JSON.stringify(msg)}`,
        );
    });
    subscription.on('close', () => {
        logger.info(
            `[PubSubService] subscription closed: ${subscription.name}`,
        );
        subscription.removeAllListeners();
    });
}

/**
 * Message publishing options
 */
export type TPublishOptions = Omit<MessageOptions, 'data' | 'json'>;

/**
 * Settings for the PubSubService
 */
export interface IPubSubServiceSettings extends ClientConfig {
    projectId: string;
    createEntityCallback?: TCreateEntityCallback;
}

/**
 * Base class for PubSub services
 */
export abstract class AbstractPubSub {
    public readonly projectId: string;
    #client: PubSub;

    constructor(options: IPubSubServiceSettings) {
        this.projectId = options.projectId;
        this.#client = new PubSub(options);
    }

    /**
     * Expose the PubSub client
     */
    public get client(): PubSub {
        return this.#client;
    }

    /**
     * Return an existing topic.  You must ensure that topic exists before calling
     * this method.  If you are not sure, call the .createTopic method instead.
     *
     * @param topicName
     * @returns
     */
    public getTopic(topicName: string, options?: PublishOptions): Topic {
        const opt = options ? options : {};
        opt.gaxOpts = generateCallOptions(opt.gaxOpts);
        return this.#client.topic(topicName, opt);
    }

    /**
     * Get an existing subscription.  You must ensure that the subscription exists before calling this method.
     * If not, call createSubscription instead.
     *
     * @param topic
     * @param subscriptionName
     * @param options
     * @returns
     */
    public getSubscription(
        topic: Topic,
        subscriptionName: string,
        options?: SubscriptionOptions,
    ): Subscription {
        return topic.subscription(subscriptionName, options);
    }
}
