import { expect } from '../testlib';
import { GaxiosError } from 'googleapis-common';
import {
    GCUtilsError,
    RetryError,
    RxJsRetryError,
    translateGaxiosError,
} from '@fp8proj/core';

describe('core.excepts', () => {
    it('translateGaxiosError - normal error', () => {
        const err = new Error('This is 0vlprYugqn error');
        const { errorMessage, error } = translateGaxiosError(err);
        expect(errorMessage).toBe('This is 0vlprYugqn error');
        expect(error).toBe(err);
    });

    it('translateGaxiosError - GaxiosError', () => {
        const message = '{"error": {"message" : "This is SFBNCIQJFD error"}}';
        const headers = new Headers();
        const url = new URL('https://example.com');

        const err = new GaxiosError(message, { headers, url });
        const { errorMessage, error } = translateGaxiosError(err);
        expect(errorMessage).toBe('This is SFBNCIQJFD error');
        expect(error).toBe(err);
    });

    it('translateGaxiosError - Gaxios like error', () => {
        const message = '{"error": {"message" : "This is yLBNMHFwDf error"}}';
        const err = new Error(message);
        const { errorMessage, error } = translateGaxiosError(err);
        expect(errorMessage).toBe('This is yLBNMHFwDf error');
        expect(error).toBe(err);
    });

    it('translateGaxiosError - Gaxios like error with bad json', () => {
        const message = '{"error": {"message" : "hlotHDnzzK';
        const err = new Error(message);
        const { errorMessage, error } = translateGaxiosError(err);
        // As message is not a valid json, the message is pass through
        expect(errorMessage).toBe(message);
        expect(error).toBe(err);
    });

    it('translateGaxiosError - Unknown', () => {
        try {
            throw 'This is KnStVtFict error';
        } catch (err) {
            expect(typeof err).toBe('string');
            const { errorMessage, error } = translateGaxiosError(err);
            // console.log('errorMessage', errorMessage);
            // console.log('error', error);
            expect(typeof errorMessage).toBe('string');
            expect(errorMessage).toBe('This is KnStVtFict error');
            expect(error.message).toBe('This is KnStVtFict error');
        }
    });

    it('GCUtilsError', () => {
        const err = new Error('test-jI5f2hGVFj');
        expect(err.toString()).toBe('Error: test-jI5f2hGVFj');
        const originalStack = err.stack;

        const gce = new GCUtilsError('test-tNkOQBKX68', err);
        expect(gce.name).toBe('GCUtilsError');
        expect(gce.constructor.name).toBe('GCUtilsError');
        expect(gce.toString()).toBe('GCUtilsError: test-tNkOQBKX68');
        expect(gce.cause).toBeInstanceOf(Error);

        const gceCause = gce.cause as Error;
        expect(gceCause.toString()).toBe('Error: test-jI5f2hGVFj');
        expect(gceCause.stack).toBe(originalStack);
    });

    it('RetryError', () => {
        const cause = new Error('cause-LUak8tBTpm');
        const err = new RetryError('error-LUak8tBTpm', cause);
        expect(err.constructor.name).toBe('RetryError');
        expect(err.message).toBe('error-LUak8tBTpm');
        expect(err.cause?.message).toBe('cause-LUak8tBTpm');
        expect(err).toBeInstanceOf(RetryError);
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(GCUtilsError);
    });

    it('RxJsRetryError', () => {
        const err = new RxJsRetryError('error-K5mPkLQq8B');
        expect(err.constructor.name).toBe('RxJsRetryError');
        expect(err.message).toBe('error-K5mPkLQq8B');
        expect(err).toBeInstanceOf(RxJsRetryError);
        expect(err).toBeInstanceOf(RetryError);
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toBeInstanceOf(GCUtilsError);
    });
});
