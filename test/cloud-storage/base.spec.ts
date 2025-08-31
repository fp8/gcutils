import { expect, testLogger } from '../testlib';
import { GCUtilsError } from '@fp8proj/core';
import {
    generateGsUri,
    parseGsPath,
    generateGsPath,
    AbstractBStore,
} from '@fp8proj/cloud-storage/base';
import { Readable, Writable } from 'stream';

import { File, Bucket } from '@google-cloud/storage';

class TestBStore extends AbstractBStore {
    protected logger = testLogger;
}

const BUCKET_NAME = process.env.GCUTILS_TEST_BUCKET;
const gspath = `gs://${BUCKET_NAME}/public/sample.pdf`;

describe('cloud-storage.base', () => {
    // Ensure environment variables are set
    beforeAll(() => {
        expect(process.env.GCUTILS_TEST_BUCKET).toBeDefined();
    });

    it('gspath conversion', () => {
        const expectedUri = {
            bucket: BUCKET_NAME,
            path: 'public/sample.pdf',
            dirname: 'public',
            filename: 'sample.pdf',
            basename: 'sample',
            extname: '.pdf',
        };

        const uri = parseGsPath(gspath);
        expect(uri).toEqual(expectedUri);

        const resUrl = generateGsPath(uri);
        expect(resUrl).toEqual(gspath);
    });

    it('gspath', () => {
        const config: any = {
            [`gs://${BUCKET_NAME}/public/sample.pdf`]: {
                bucket: BUCKET_NAME,
                path: 'public/sample.pdf',
                dirname: 'public',
                filename: 'sample.pdf',
                basename: 'sample',
                extname: '.pdf',
            },
            [`gs://${BUCKET_NAME}/public/deep/sample.pdf`]: {
                bucket: BUCKET_NAME,
                path: 'public/deep/sample.pdf',
                dirname: 'public/deep',
                filename: 'sample.pdf',
                basename: 'sample',
                extname: '.pdf',
            },
            [`gs://${BUCKET_NAME}/public/deep/`]: {
                bucket: BUCKET_NAME,
                path: 'public/deep/',
                dirname: 'public/deep',
                filename: '',
                basename: '',
                extname: '',
            },
            [`gs://${BUCKET_NAME}/public/deep`]: {
                bucket: BUCKET_NAME,
                path: 'public/deep',
                dirname: 'public',
                filename: 'deep',
                basename: 'deep',
                extname: '',
            },
            [`gs://${BUCKET_NAME}/public/`]: {
                bucket: BUCKET_NAME,
                path: 'public/',
                dirname: 'public',
                filename: '',
                basename: '',
                extname: '',
            },
            [`gs://${BUCKET_NAME}/public`]: {
                bucket: BUCKET_NAME,
                path: 'public',
                dirname: '',
                filename: 'public',
                basename: 'public',
                extname: '',
            },
            [`gs://${BUCKET_NAME}/`]: {
                bucket: BUCKET_NAME,
                path: '',
                dirname: '',
                filename: '',
                basename: '',
                extname: '',
            },
            [`gs://${BUCKET_NAME}`]: {
                bucket: BUCKET_NAME,
                path: '',
                dirname: '',
                filename: '',
                basename: '',
                extname: '',
            },
        };

        for (const gspath of Object.keys(config)) {
            const expected: any = config[gspath];
            const uri = parseGsPath(gspath);
            expect(uri).toEqual(expected);
        }
    });

    it('generateGsUri 2 args', () => {
        const uri = generateGsUri(
            'icb-summit-dev',
            'input_XO30.SummitFOU.Diamantech.20220420.tar',
        );
        expect(uri).toEqual({
            basename: 'input_XO30.SummitFOU.Diamantech.20220420',
            bucket: 'icb-summit-dev',
            dirname: '',
            extname: '.tar',
            filename: 'input_XO30.SummitFOU.Diamantech.20220420.tar',
            path: 'input_XO30.SummitFOU.Diamantech.20220420.tar',
        });

        const expectedPath =
            'gs://icb-summit-dev/input_XO30.SummitFOU.Diamantech.20220420.tar';
        expect(generateGsPath(uri)).toEqual(expectedPath);
    });

    it('generateGsUri 2 args with dir', () => {
        const uri = generateGsUri(
            'icb-summit-dev',
            'test-input/input_XO30.SummitFOU.Diamantech.20220420.tar',
        );
        expect(uri).toEqual({
            basename: 'input_XO30.SummitFOU.Diamantech.20220420',
            bucket: 'icb-summit-dev',
            dirname: 'test-input',
            extname: '.tar',
            filename: 'input_XO30.SummitFOU.Diamantech.20220420.tar',
            path: 'test-input/input_XO30.SummitFOU.Diamantech.20220420.tar',
        });

        const expectedPath =
            'gs://icb-summit-dev/test-input/input_XO30.SummitFOU.Diamantech.20220420.tar';
        expect(generateGsPath(uri)).toEqual(expectedPath);
    });

    it('generateGsUri 3 args', () => {
        const uri = generateGsUri(
            'icb-summit-dev',
            'input_XO30.SummitFOU.Diamantech.20220420.tar',
            'test-input',
        );
        expect(uri).toEqual({
            basename: 'input_XO30.SummitFOU.Diamantech.20220420',
            bucket: 'icb-summit-dev',
            dirname: 'test-input',
            extname: '.tar',
            filename: 'input_XO30.SummitFOU.Diamantech.20220420.tar',
            path: 'test-input/input_XO30.SummitFOU.Diamantech.20220420.tar',
        });

        const expectedPath =
            'gs://icb-summit-dev/test-input/input_XO30.SummitFOU.Diamantech.20220420.tar';
        expect(generateGsPath(uri)).toEqual(expectedPath);
    });

    it('bstore.createWriteableStream - error callback', (done) => {
        const testFile = 'gs://a-random-JSo6MOBhHX-bucket/this/does/not/exists';
        const expectedErrorMessage =
            "Invalid bucket name: 'a-random-JSo6MOBhHX-bucket'";

        // Capture the error
        let error: Error | undefined = undefined;
        const bstore = new TestBStore({
            errorHandler: (err) => {
                // Callback error is transformed into GCUtilsError
                expect(err).toBeInstanceOf(GCUtilsError);
                expect(err?.message).toBe(expectedErrorMessage);
                expect((err as GCUtilsError).cause?.message).toContain(
                    expectedErrorMessage,
                );
                error = err;
            },
        });

        // Raise error by writing to stream
        const stream = bstore.createWriteableStream(testFile);
        stream.write('lorem ipsum');
        stream.end();

        // Make sure that error event is fired
        let errorEventCalled: boolean = false;
        stream.on('error', (err) => {
            expect(err?.constructor?.name).toBe('GaxiosError');
            expect(err?.message).toMatch(/^{/);
            expect(err?.message).toContain(expectedErrorMessage);
            errorEventCalled = true;
        });

        // close event should be after error.
        stream.on('close', () => {
            // Make sure that error event is fired
            expect(errorEventCalled).toBeTruthy;
            // Check that expected error is sent in callback
            expect(error).toBeDefined();
            done();
        });
    });

    it('bstore.createWriteableStream - error event', (done) => {
        const testFile = 'gs://a-random-30NoF4f3pQ-bucket/this/does/not/exists';
        const expectedErrorMessage =
            "Invalid bucket name: 'a-random-30NoF4f3pQ-bucket'";

        // Capture the error
        const bstore = new TestBStore();
        const stream = bstore.createWriteableStream(testFile);
        stream.end();

        // Make sure that error event is fired
        let errorEventCalled: boolean = false;
        stream.on('error', (err) => {
            expect(err?.constructor?.name).toBe('GaxiosError');
            expect(err?.message).toMatch(/^{/);
            expect(err?.message).toContain(expectedErrorMessage);
            errorEventCalled = true;
        });

        stream.on('close', () => {
            // Make sure that error event is fired
            expect(errorEventCalled).toBeTruthy;
            done();
        });
    });

    it('bstore.createReadableStream - error event', (done) => {
        const testFile = 'gs://a-random-IWS8PdHfMv-bucket/this/does/not/exists';
        // NOTE: the encoded &#39; is really be a bug of the Cloud Storage SDK
        const expectedErrorMessage =
            'Invalid bucket name: &#39;a-random-IWS8PdHfMv-bucket&#39;';

        // Note that in this case, the error is simply ignored.
        let error: Error | undefined = undefined;
        const bstore = new TestBStore({
            errorHandler: (err) => {
                // Callback error is transformed into GCUtilsError
                expect(err).toBeInstanceOf(GCUtilsError);
                expect(err?.message).toBe(expectedErrorMessage);
                expect((err as GCUtilsError).cause?.message).toContain(
                    expectedErrorMessage,
                );
                error = err;
            },
        });
        const stream = bstore.createReadableStream(testFile);

        // Read data to trigger the error
        const _ = stream.read();

        // Make sure that error event is fired
        let errorEventCalled: boolean = false;
        stream.on('error', (err) => {
            expect(err?.constructor?.name).toBe('ApiError');
            expect(err?.message).toBe(expectedErrorMessage);
            errorEventCalled = true;
        });

        stream.on('close', () => {
            // Make sure that error event is fired
            expect(errorEventCalled).toBeTruthy;
            // Check that expected error is sent in callback
            expect(error).toBeDefined();
            done();
        });
    });

    /**
     * This test is not going to pass as BStore will throw an exception in the event
     * and therefore causing uncaughtException.  The close event is never fired.
     */
    it.skip('bstore.createWriteableStream - no error checking - uncaughtException', (done) => {
        const testFile = 'gs://a-random-Bsx3JirVgG-bucket/this/does/not/exists';

        // Note that in this case, the error is simply ignored.
        const bstore = new TestBStore();
        const stream = bstore.createWriteableStream(testFile);
        stream.write('lorem ipsum');
        stream.end();

        stream.on('close', () => {
            done();
        });
    });

    /**
     * This test is not going to pass as BStore will throw an exception in the event
     * and therefore causing uncaughtException.  The close event is never fired.
     */
    it.skip('bstore.createReadableStream - no error checking - uncaughtException', (done) => {
        const testFile = 'gs://a-random-hODZxXl29o-bucket/this/does/not/exists';

        // Note that in this case, the error is simply ignored.
        const bstore = new TestBStore();
        const stream = bstore.createReadableStream(testFile);
        const _ = stream.read();

        stream.on('close', () => {
            done();
        });
    });

    it('parseGsPath throws error for missing host', () => {
        expect(() => parseGsPath('gs:///some/path')).toThrow(
            'No valid host passed in path uri',
        );
    });

    it('parseGsPath throws error for invalid protocol', () => {
        expect(() => parseGsPath('http://bucket/path')).toThrow(
            'Invalid protocol',
        );
    });

    it('generateGsPath throws for missing bucket or path', () => {
        // @ts-expect-error purposely passing invalid object
        expect(() => generateGsPath({})).toThrow('Invalid gsuri passed');
        expect(() => {
            // @ts-expect-error purposely passing invalid object
            generateGsPath({ path: 'foo', bucket: undefined });
        }).toThrow('Invalid gsuri passed');
        expect(() => {
            // @ts-expect-error purposely passing invalid object
            generateGsPath({ bucket: 'bucket', path: undefined });
        }).toThrow('Invalid gsuri passed');
    });

    it('createReadableStream throws if no error handler and no error listener', (done) => {
        const errorMessage = 'dummy error gDviZfRKcq';
        class NoHandlerBStore extends AbstractBStore {
            protected logger = testLogger;
        }

        const testErrHandler = (err: Error) => {
            expect(err.message).toBe(errorMessage);
            done();
        };

        const bstore = new NoHandlerBStore({ errorHandler: testErrHandler });
        // Patch getBlob to return a dummy stream that triggers error
        const dummyStream = new Readable({
            read() {
                this.emit('error', new Error(errorMessage));
            },
        });
        jest.spyOn(bstore as any, 'getBlob').mockReturnValue({
            createReadStream: () => dummyStream,
        });

        // The exception should be caught by the testErrHandler
        bstore.createReadableStream('gs://bucket/file').read();
    });

    it('createWriteableStream throws if no error handler and no error listener', (done) => {
        const errorMessage = 'dummy error foS2oqBOaf';
        class NoHandlerBStore extends AbstractBStore {
            protected logger = testLogger;
        }
        const testErrHandler = (err: Error) => {
            expect(err.message).toBe(errorMessage);
            done();
        };

        const bstore = new NoHandlerBStore({ errorHandler: testErrHandler });
        // Patch getBlob to return a dummy stream that triggers error
        const dummyStream = new Writable({
            write(
                _chunk: any,
                _encoding: string,
                callback: (error?: Error | null) => void,
            ) {
                callback(new Error(errorMessage));
            },
        });
        jest.spyOn(bstore as any, 'getBlob').mockReturnValue({
            createWriteStream: () => dummyStream,
        });

        // The exception should be caught by the testErrHandler
        bstore.createWriteableStream('gs://bucket/file').write('test data');
    });

    it('getBlob returns File instance as is', () => {
        const bstore = new TestBStore();
        // Create a mock bucket since we can't access private storage
        const mockBucket = {} as Bucket;
        const file = new File(mockBucket, 'file-name');
        expect(bstore['getBlob'](file)).toBe(file);
    });
});
