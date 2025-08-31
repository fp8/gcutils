import { checkIfHostResolves } from '../../src/core/helper';
import { METADATA_HOST } from '../../src/metadata/mdata';
import { Chrono } from '../testlib';
import { Timestamp } from '@google-cloud/firestore';
import * as http from 'http';
import * as https from 'https';

import { RetryError } from '@fp8proj/core';
import { convertToDate, retry, fetcher } from '@fp8proj/core/helper';

// Mock the http and https modules
jest.mock('http');
jest.mock('https');
const mockHttp = http as jest.Mocked<typeof http>;
const mockHttps = https as jest.Mocked<typeof https>;

describe('helper', () => {
    const chrono = new Chrono();

    describe('checkIfHostResolves', () => {
        const expectedElapsedMsForResolve = 100;

        it('should resolve a known good hostname (e.g. google.com)', async () => {
            // google.com should always resolve
            chrono.start();
            await expect(checkIfHostResolves('google.com')).resolves.toBe(true);
            // Normal wait should be less than 20 ms
            expect(chrono.elapsed()).toBeLessThan(expectedElapsedMsForResolve);
        });

        it('should resolve a known good url (e.g. https://www.google.com)', async () => {
            // https://www.google.com should always resolve
            const url = new URL('https://www.google.com/search');
            chrono.start();
            await expect(checkIfHostResolves(url)).resolves.toBe(true);
            // Normal wait should be less than 20 ms
            expect(chrono.elapsed()).toBeLessThan(expectedElapsedMsForResolve);
        });

        it('should fail to resolve a non-existent hostname', async () => {
            chrono.start();
            await expect(
                checkIfHostResolves('nonexistent-hostname-xyz-1234.com'),
            ).resolves.toBe(false);
            // Normal wait should be less than 20 ms
            expect(chrono.elapsed()).toBeLessThan(expectedElapsedMsForResolve);
        });

        it('should fail to resolve METADATA_HOST (should not be reachable from tests)', async () => {
            chrono.start();
            await expect(checkIfHostResolves(METADATA_HOST)).resolves.toBe(
                false,
            );
            // Normal wait should be less than 20 ms
            expect(chrono.elapsed()).toBeLessThan(expectedElapsedMsForResolve);
        });
    });

    describe('convertToDate', () => {
        it('returns undefined for empty input', () => {
            expect(convertToDate(undefined)).toBeUndefined();
            expect(convertToDate(null)).toBeUndefined();
            expect(convertToDate('')).toBeUndefined();
        });

        it('parses ISO string to Date', () => {
            const dateStr = '2023-06-21T12:34:56.789Z';
            const result = convertToDate(dateStr);
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe(dateStr);
        });

        it('uses custom dateParser if provided', () => {
            const parser = (input: string) =>
                input === 'foo' ? new Date('2020-01-01T00:00:00Z') : undefined;
            const result = convertToDate('foo', parser);
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
        });

        it('returns Date if input is already a Date', () => {
            const date = new Date('2022-01-01T00:00:00Z');
            expect(convertToDate(date)).toBe(date);
        });

        it('converts Firestore Timestamp to Date', () => {
            const ts = new Timestamp(1234567890, 123000000);
            const result = convertToDate(ts);
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(ts.toDate().getTime());
        });

        it('converts object with _seconds and _nanoseconds to Date', () => {
            const obj = { _seconds: 1234567890, _nanoseconds: 123000000 };
            const ts = new Timestamp(obj._seconds, obj._nanoseconds);
            const result = convertToDate(obj);
            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(ts.toDate().getTime());
        });

        it('throws error for invalid string date', () => {
            expect(() => convertToDate('not-a-date')).toThrow(/Invalid Date/);
        });

        it('throws error for unknown object', () => {
            expect(() => convertToDate({ foo: 'bar' })).toThrow(/Converting/);
        });
    });

    describe('retry', () => {
        const retryError = new RetryError('retry me');
        const defaultRetryWaitFor = 100;

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('Simple retry usage', async () => {
            const action = jest.fn().mockResolvedValue('val-90Fp8ZGHGs');

            const { result, elapsed } = await chrono.timeint(() =>
                retry<string>(action),
            );

            expect(elapsed).toBeLessThanOrEqual(10);
            expect(result).toBe('val-90Fp8ZGHGs');
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('Simple retry usage - undefined', async () => {
            const action = jest
                .fn()
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce('val-C6lzeuZkR3');

            const { result, elapsed } = await chrono.timeint(() =>
                retry<string>(action),
            );

            expect(elapsed).toBeGreaterThan(defaultRetryWaitFor * 2);
            expect(result).toBe('val-C6lzeuZkR3');
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('Simple retry usage - errors', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(new Error('Error 1 pA8LKBpjQ6'))
                .mockRejectedValueOnce(new Error('Error 2 pA8LKBpjQ6'))
                .mockResolvedValue('val-pA8LKBpjQ6');

            const { result, elapsed } = await chrono.timeint(() =>
                retry<string>(action),
            );

            expect(elapsed).toBeGreaterThan(defaultRetryWaitFor * 2);
            expect(result).toBe('val-pA8LKBpjQ6');
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('return undefined from action - retryOnUndefined = false', async () => {
            const action = jest
                .fn()
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce('val-C6lzeuZkR3');

            const { result, elapsed } = await chrono.timeint(() =>
                retry<string>(action, { retryOnUndefined: false }),
            );

            expect(elapsed).toBeLessThan(10);
            expect(result).toBeUndefined();
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('returns true when action succeeds on first attempt', async () => {
            const action = jest.fn().mockResolvedValue(true);

            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 50, maxRetry: 3 }),
            );

            expect(elapsed).toBeLessThan(10);
            expect(result).toBe(true);
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('waits specified time between retries', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(retryError)
                .mockResolvedValueOnce('done');

            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 50, maxRetry: 3 }),
            );

            expect(elapsed).toBeGreaterThan(49);
            expect(elapsed).toBeLessThan(60);
            expect(result).toBe('done');
            expect(action).toHaveBeenCalledTimes(2);
        });

        it('returns true when action succeeds after retries', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(retryError)
                .mockResolvedValueOnce(retryError)
                .mockResolvedValueOnce(true);
            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 15, maxRetry: 5 }),
            );

            expect(elapsed).toBeGreaterThan(30);
            expect(elapsed).toBeLessThan(40);
            expect(result).toBe(true);
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('returns undefined when action fails after reaching maxRetry', async () => {
            const action = jest.fn().mockRejectedValue(retryError);

            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 10, maxRetry: 3 }),
            );

            expect(elapsed).toBeGreaterThan(20); // the 3rd retry will not call delay
            expect(elapsed).toBeLessThan(40);
            expect(result).toBeUndefined();
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('returns undefined when maxRetry is 1', async () => {
            const error = new Error('maxRetry error 1');
            const action = jest.fn().mockRejectedValue(error);

            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 10, maxRetry: 1 }),
            );

            expect(elapsed).toBeLessThan(10); // Delay will not be called at all
            expect(result).toBeUndefined();
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('waits specified time between retries', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(retryError)
                .mockRejectedValueOnce(retryError)
                .mockResolvedValueOnce(true);

            const { result, elapsed } = await chrono.timeint(() =>
                retry(action, { waitFor: 50, maxRetry: 3 }),
            );

            expect(elapsed).toBeGreaterThan(100);
            expect(elapsed).toBeLessThan(110);
            expect(result).toBe(true);
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('Retry on any errors as default', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(new Error('Error 1 WBiWQXR0CA'))
                .mockResolvedValueOnce('result-WBiWQXR0CA');
            chrono.start();
            await expect(retry(action, { waitFor: 50 })).resolves.toBe(
                'result-WBiWQXR0CA',
            );
            expect(chrono.elapsed()).toBeGreaterThanOrEqual(50);
            expect(action).toHaveBeenCalledTimes(2);
        });

        it('Retry on only on RetryError - retryOnAllErrors false', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(new RetryError('retry error zwVlmP2GWh'))
                .mockRejectedValueOnce(new Error('error zwVlmP2GWh'))
                .mockResolvedValueOnce('result-zwVlmP2GWh');
            chrono.start();
            await expect(
                retry(action, { waitFor: 50, retryOnAllErrors: false }),
            ).rejects.toThrow(/error zwVlmP2GWh/);
            expect(action).toHaveBeenCalledTimes(2);
            expect(chrono.elapsed()).toBeGreaterThanOrEqual(50);
        });

        it('supports custom shouldRetry result predicate', async () => {
            const action = jest
                .fn()
                .mockResolvedValueOnce('no')
                .mockResolvedValueOnce('no')
                .mockResolvedValueOnce('yes');
            const shouldRetry = (result: string | Error) => result !== 'yes';

            await expect(retry<string>(action, { shouldRetry })).resolves.toBe(
                'yes',
            );
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('supports custom shouldRetry error predicate', async () => {
            const action = jest
                .fn()
                .mockRejectedValueOnce(new Error('retry-YknOJVlxab'))
                .mockResolvedValueOnce(new Error('retry-YknOJVlxab'))
                .mockResolvedValueOnce(new Error('err-YknOJVlxab'));
            const shouldRetry = (result: string | Error) => {
                if (result instanceof Error) {
                    return result.message === 'retry-YknOJVlxab';
                }
                return false;
            };

            const opt = {
                waitFor: 50,
                retryOnAllErrors: false,
                shouldRetry,
            };

            chrono.start();
            await expect(retry<string>(action, opt)).rejects.toThrow(
                /err-YknOJVlxab/,
            );
            expect(chrono.elapsed()).toBeGreaterThanOrEqual(100);
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('retries action with error handling using try-catch wrapper', async () => {
            let callCount = 0;
            const action = jest.fn().mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First attempt fails');
                }
                return true;
            });

            const wrappedAction = async () => {
                try {
                    return await action();
                } catch {
                    return retryError;
                }
            };

            const result = await retry(wrappedAction, {
                waitFor: 10,
                maxRetry: 3,
            });

            expect(result).toBe(true);
            expect(action).toHaveBeenCalledTimes(2);
        });
    });

    describe('fetcher', () => {
        const originalFetch = global.fetch;
        const originalEnv = process.env;

        beforeEach(() => {
            jest.clearAllMocks();
            process.env = { ...originalEnv };
            global.fetch = jest.fn();
        });

        afterEach(() => {
            global.fetch = originalFetch;
            process.env = originalEnv;
        });

        it('should make a successful fetch request', async () => {
            const mockResponse = 'test response';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(mockResponse),
            } as any);

            const result = await fetcher('https://example.com');

            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
                headers: {
                    'User-Agent': '@farport/gcutils',
                },
            });
        });

        it('should include custom headers', async () => {
            const mockResponse = 'test response';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(mockResponse),
            } as any);

            const customHeaders = {
                'Content-Type': 'application/json',
                'X-Custom-Header': 'custom-value',
            };

            await fetcher('https://example.com', customHeaders);

            expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
                headers: {
                    'User-Agent': '@farport/gcutils',
                    'Content-Type': 'application/json',
                    'X-Custom-Header': 'custom-value',
                },
            });
        });

        it('should add Authorization header from FP8_FETCH_TOKEN env var', async () => {
            process.env.FP8_FETCH_TOKEN = 'test-token-123';
            const mockResponse = 'test response';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(mockResponse),
            } as any);

            await fetcher('https://example.com');

            expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
                headers: {
                    'User-Agent': '@farport/gcutils',
                    Authorization: 'Bearer test-token-123',
                },
            });
        });

        it('should not override existing Authorization header', async () => {
            process.env.FP8_FETCH_TOKEN = 'env-token';
            const mockResponse = 'test response';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(mockResponse),
            } as any);

            const customHeaders = {
                Authorization: 'Bearer custom-token',
            };

            await fetcher('https://example.com', customHeaders);

            expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
                headers: {
                    'User-Agent': '@farport/gcutils',
                    Authorization: 'Bearer custom-token',
                },
            });
        });

        it('should handle URL object as input', async () => {
            const mockResponse = 'test response';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(mockResponse),
            } as any);

            const url = new URL('https://example.com/path');
            const result = await fetcher(url);

            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(url, {
                headers: {
                    'User-Agent': '@farport/gcutils',
                },
            });
        });

        it('should throw error for failed HTTP status', async () => {
            const mockErrorText = 'Not Found';
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: jest.fn().mockResolvedValueOnce(mockErrorText),
            } as any);

            await expect(fetcher('https://example.com')).rejects.toThrow(
                'Fetch failed: Fetch error status 404: Not Found',
            );
        });

        it('should throw error when fetch throws', async () => {
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetcher('https://example.com')).rejects.toThrow(
                'Fetch failed: Network error',
            );
        });

        it('should handle empty response', async () => {
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValueOnce(''),
            } as any);

            const result = await fetcher('https://example.com');

            expect(result).toBe('');
        });
    });
});
