import { expect } from '../testlib';

import * as fs from 'fs';
import { BStore } from '@fp8proj/cloud-storage';
import { Writable } from 'stream';

const BUCKET_NAME = process.env.GCUTILS_TEST_BUCKET;
const gspathPublic = `gs://${BUCKET_NAME}/public`;
const gspathPdf = `${gspathPublic}/sample.pdf`;

class TestBStoreForFiles extends BStore {
    public setMockBucket(mockBucket: any) {
        // Use jest.spyOn to mock the getBucket method instead of accessing private field
        jest.spyOn(this, 'getBucket' as any).mockReturnValue(mockBucket);
    }
}

describe('cloud-storage.BStore', () => {
    const bstore = new BStore();

    // Ensure environment variables are set
    beforeAll(() => {
        expect(process.env.GCUTILS_TEST_BUCKET).toBeDefined();
    });

    it('meta', async () => {
        const meta = await bstore.meta(gspathPdf);
        expect(meta).toHaveProperty('contentType', 'application/pdf');
    });

    /**
     * A directory for GCS must ends with / and it's meta
     * but meta won't work for a directory.
     */
    it('meta dir', async () => {
        await expect(bstore.meta(`${gspathPublic}/`)).rejects.toHaveProperty(
            'message',
            expect.stringMatching(/No such object/i),
        );

        await expect(bstore.meta(gspathPublic)).rejects.toHaveProperty(
            'message',
            expect.stringMatching(/No such object/i),
        );
    });

    it('blob', async () => {
        const expected = fs.readFileSync('test/data/sample.pdf.txt', {
            encoding: 'utf8',
        });
        const data = await bstore.read(gspathPdf);
        expect(data.toString('base64')).toEqual(expected);
    });

    it('retrieve', async () => {
        const result = await bstore.retrieve(gspathPdf);

        expect(result).toHaveProperty(
            'gs',
            expect.objectContaining({ bucket: BUCKET_NAME }),
        );

        expect(result).toHaveProperty(
            'meta',
            expect.objectContaining({ bucket: BUCKET_NAME }),
        );

        expect(result).toHaveProperty(
            'meta',
            expect.objectContaining({ contentType: 'application/pdf' }),
        );

        expect(result).toHaveProperty('buffer');
        expect(result.buffer.length).toBeGreaterThan(13800);
    });

    it('getFiles', async () => {
        const publicPath = `${gspathPublic}/`;

        const resp = await bstore.getFiles(publicPath);
        const result = resp.map((file) => file.name);

        expect(result).toEqual(['public/man-join.txt', 'public/sample.pdf']);
    });

    it('processFiles', async () => {
        const publicPath = `${gspathPublic}/`;

        const result = await bstore.processFiles<string>(publicPath, (file) =>
            Promise.resolve(file.name),
        );
        expect(result).toEqual(['public/man-join.txt', 'public/sample.pdf']);
    });

    it('exists', async () => {
        const testFile = `${gspathPublic}/file-does-not-exists.txt`;

        const found = await bstore.exists(testFile, 1, 2);
        expect(found).toBeFalsy();
    });

    it('createWriteableStream and delete', async () => {
        const testFile = `${gspathPublic}/test/test-bstorex-7pN8gciIDz.txt`;
        const inputText = 'This is testFile for BStore with data 7pN8gciIDz';

        const stream = bstore.createWriteableStream(testFile);

        // Note: it's is critical to wait for the stream end callback or the
        // file might not be created
        await writeAndCloseStream(stream, inputText);

        // Need to wait until file exists.
        const meta = await bstore.exists(testFile).then((found) => {
            if (found) {
                return bstore.meta(testFile);
            } else {
                throw new Error(`File ${testFile} not found`);
            }
        });

        // console.log('# META', meta);
        expect(meta.size).toEqual('48');
        expect(meta.md5Hash).toEqual('gVeooD5V52WnMWKcIofSow==');

        // Now delete the file
        await bstore.deleteFiles(testFile);

        const found = await bstore.exists(testFile);
        expect(found).toBeFalsy();
    }, 15000);

    it('read propagates error from stream', async () => {
        const localBstore = new BStore();
        // Patch createReadableStream to emit error
        const error = new Error('stream error');
        jest.spyOn(localBstore, 'createReadableStream').mockImplementation(
            () => {
                const { Readable } = require('stream');
                const s = new Readable({
                    read() {
                        this.emit('error', error);
                    },
                });
                return s;
            },
        );
        await expect(localBstore.read('gs://bucket/file')).rejects.toBe(error);
    });

    it('read catches thrown error from createReadableStream', async () => {
        const localBstore = new BStore();
        const thrown = new Error('thrown error');
        jest.spyOn(localBstore, 'createReadableStream').mockImplementation(
            () => {
                throw thrown;
            },
        );
        await expect(localBstore.read('gs://bucket/file')).rejects.toBe(thrown);
    });

    it('getFiles filters out directories', async () => {
        const files = [
            { name: 'foo.txt' },
            { name: 'bar/' },
            { name: 'baz.pdf' },
        ];
        const bucket = { getFiles: jest.fn().mockResolvedValue([files]) };
        const testBstore = new TestBStoreForFiles();
        testBstore.setMockBucket(bucket);
        const result = await testBstore.getFiles('gs://bucket/path');
        expect(result.map((f) => f.name)).toEqual(['foo.txt', 'baz.pdf']);
    });

    it('processFiles returns all results from action', async () => {
        const files = [{ name: 'a' }, { name: 'b' }];
        bstore.getFiles = jest.fn().mockResolvedValue(files);
        const result = await bstore.processFiles('gs://bucket/path', (file) =>
            Promise.resolve(file.name + 'X'),
        );
        expect(result).toEqual(['aX', 'bX']);
    });

    it('processFiles returns empty array if no files', async () => {
        bstore.getFiles = jest.fn().mockResolvedValue([]);
        const result = await bstore.processFiles('gs://bucket/path', (file) =>
            Promise.resolve(file.name + 'X'),
        );
        expect(result).toEqual([]);
    });
});

/**
 * Write data to a stream and wait for it to finish.
 *
 * @param stream The writable stream
 * @param data The data to write
 * @returns A promise that resolves when the write is complete
 */
async function writeAndCloseStream(
    stream: Writable,
    data: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        stream.write(data, (err) => {
            if (err) {
                return reject(err);
            }
            stream.end(resolve);
        });
    });
}
