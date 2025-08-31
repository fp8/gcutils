import { delay, isEmpty } from 'jlog-facade';
import { Timestamp } from '@google-cloud/firestore';
import * as dns from 'node:dns';
import * as util from 'node:util';

import { RetryError } from './excepts';
import { createLogger } from './logger';

const logger = createLogger('helper');
const resolve = util.promisify(dns.resolve);

/**
 * Designed to be used when an Error is caught.  JS allow you to throw anything so
 * the error caught might not be an instance of error.  Optionally allow you to send
 * a custom error message.
 *
 * If the custom error message ends with a colon, the original error message will be appended.
 *
 * @param message
 * @param error
 * @returns
 */
export function createError(message: string | unknown, error?: unknown): Error {
    if (typeof message === 'string') {
        // Error message provided
        if (error === undefined) {
            // This branch shouldn't really be used by the caller.  It works but make no sense
            return new Error(message);
        } else {
            if (message.endsWith(':')) {
                // If message ends with colon, append the original error message
                if (error instanceof Error) {
                    return new Error(`${message} ${error.message}`, {
                        cause: error,
                    });
                } else {
                    return new Error(`${message} ${error}`);
                }
            } else {
                // Throw error using message provided and add original error as cause
                return new Error(message, { cause: error });
            }
        }
    } else {
        // Is message is not a string, ignore the error param
        if (message instanceof Error) {
            return message;
        } else {
            return new Error(`Unknown error ${message}`);
        }
    }
}

/**
 * A very simple DNS resolver that translates hostname into ip addresses
 *
 * @param input
 * @returns
 */
export async function checkIfHostResolves(
    input: string | URL,
): Promise<boolean> {
    const hostname = typeof input === 'string' ? input : input.hostname;
    const retryOptions = {
        waitFor: 10,
    };
    try {
        const output = await retry<boolean>(async () => {
            try {
                const resp = await resolve(hostname, 'A');
                return resp.length > 0;
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const error = err as any;
                if (error.code === 'ENOTFOUND') {
                    return false;
                } else {
                    throw err;
                }
            }
        }, retryOptions);
        return output ?? false;
    } catch (err) {
        logger.error(`[dnsResolve] Failed to resolve ${hostname}: ${err}`);
        throw err;
    }
}

/**
 * Options for the retry mechanism
 */
export interface IRetryOptions<T> {
    waitFor: number; // Default to 100 ms
    maxRetry: number; // Default to 3
    retryOnUndefined: boolean; // Default to true.  If false, action will not be retried if it returns undefined
    retryOnAllErrors: boolean; // Default to true.  If false, only retry on RetryError
    shouldRetry?: (result: T | Error) => boolean;
}

/**
 * Retry an action that returns a value of type T and retry if action returns undefined
 * or upon error.  After maxRetry is reached, it will return undefined.
 *
 * Options:
 *
 * - waitFor: number of milliseconds to wait before retrying (default: 100)
 * - maxRetry: maximum number of retry attempts (default: 3)
 * - retryOnUndefined: whether to retry if the result is undefined (default: true)
 * - retryOnAllErrors: whether to retry on all errors or only RetryError
 *   (default: true - retry on all errors)
 * - shouldRetry: optional predicate to determine if the result is successful
 *
 * @param action
 * @param options
 * @returns
 */
export async function retry<T>(
    action: () => Promise<T>,
    options: Partial<IRetryOptions<T>> = {},
): Promise<T | undefined> {
    const opt: IRetryOptions<T> = {
        waitFor: options.waitFor ?? 100,
        maxRetry: options.maxRetry ?? 3,
        retryOnUndefined: options.retryOnUndefined ?? true,
        retryOnAllErrors: options.retryOnAllErrors ?? true,
        shouldRetry: options.shouldRetry,
    };

    let counter = 0;
    while (counter < opt.maxRetry) {
        counter += 1;

        // Checking the counter and then call delay is needed to allow the `continue` to work
        if (counter > 1) {
            logger.debug(`retry number ${counter} action in ${opt.waitFor}`);
            await delay(opt.waitFor);
        }

        // Call the action in a try catch
        try {
            const result = await action();

            // If shouldRetry is provided, check the result and retry if true
            if (opt.shouldRetry && opt.shouldRetry(result)) {
                logger.debug(`shouldRetry is true from result, will retry`);
                continue;
            }

            // If result is ever an Error, we should throw it
            if (result instanceof Error) {
                throw result;
            }

            // If result is undefined and retryOnUndefined is true, we should retry
            if (result === undefined && opt.retryOnUndefined) {
                logger.debug(`Result is undefined, will retry`);
                continue;
            }

            // Return the result
            return result;
        } catch (err) {
            // If shouldRetry is provided, check the result and retry if true
            if (
                opt.shouldRetry &&
                err instanceof Error &&
                opt.shouldRetry(err)
            ) {
                logger.debug(`shouldRetry is true from error, will retry`);
                continue;
            } else if (opt.retryOnAllErrors) {
                logger.debug(`Error caught, will retry: ${err}`);
                continue;
            } else if (err instanceof RetryError) {
                logger.debug(`RetryError caught, will retry: ${err.message}`);
                continue;
            } else {
                throw err;
            }
        }
    }
    logger.debug(`Max retries ${opt.maxRetry} reached, giving up`);
    return undefined;
}
/**
 * Convert a input to a Date
 *
 * - string: assume it's an iso date and optionally use a dateParser to convert it to date
 * - Timestamp: call .toDate()
 * - Object with _seconds and _nanoseconds: create a Timestamp and call .toDate()
 *
 */
export function convertToDate(
    input: unknown,
    dateParser?: (input: string) => Date | undefined,
): Date | undefined {
    if (isEmpty(input)) {
        return undefined;
    }

    let output: Date | undefined = undefined;
    if (typeof input === 'string') {
        if (dateParser) {
            output = dateParser(input);
        } else {
            output = new Date(input);
        }
    } else if (input instanceof Date) {
        output = input;
    } else if (input instanceof Timestamp) {
        output = input.toDate();
    } else if (
        input instanceof Object &&
        '_seconds' in input &&
        '_nanoseconds' in input
    ) {
        const seconds = input['_seconds'] as number;
        const nanoseconds = input['_nanoseconds'] as number;
        const timestamp = new Timestamp(seconds, nanoseconds);
        output = timestamp.toDate();
    }

    if (output === undefined) {
        throw new Error(
            `[convertToDate] Converting ${JSON.stringify(input)} to a Date object`,
        );
    } else if (isNaN(output.getTime())) {
        throw new Error(
            `[convertToDate] Converting ${JSON.stringify(input)} to a Date object resulted in an Invalid Date`,
        );
    }

    return output;
}

/**
 * PRIVATE: do not expose
 *
 * A private to gcutils wrapper around fetch to make HTTP/HTTPS calls
 *
 * Support bearer token if FP8_FETCH_TOKEN is set
 */
export async function fetcher(
    url: string | URL,
    headers?: Record<string, string>,
): Promise<string> {
    const headersToUse: RequestInit['headers'] = {
        'User-Agent': '@farport/gcutils',
        ...headers, // Merge additional headers
    };

    if (
        headers?.['Authorization'] === undefined &&
        process.env.FP8_FETCH_TOKEN
    ) {
        headersToUse.Authorization = `Bearer ${process.env.FP8_FETCH_TOKEN}`;
    }

    try {
        const response = await fetch(url, { headers: headersToUse });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`Fetch error status ${response.status}: ${text}`);
        }
        return text;
    } catch (err) {
        const error = createError('Fetch failed:', err);
        throw error;
    }
}
