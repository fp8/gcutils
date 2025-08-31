import { expect, allValuesFrom } from '../testlib';

import * as fs from 'fs';
import { map, lastValueFrom, mergeMap, throwError, Subscriber } from 'rxjs';
import { BStoreRx } from '@fp8proj/cloud-storage';

const BUCKET_NAME = process.env.GCUTILS_TEST_BUCKET;
const gspathDirectory = `gs://${BUCKET_NAME}/public`;
const gspathSampleFile = `${gspathDirectory}/sample.pdf`;

describe('cloud-storage.BStore', () => {
    const bstore = new BStoreRx();

    it('meta', async () => {
        const meta = await lastValueFrom(bstore.meta(gspathSampleFile));
        expect(meta).toHaveProperty('contentType', 'application/pdf');
    });

    /**
     * A directory for GCS must ends with / and it's meta
     * but meta won't work for a directory.
     */
    it('meta dir', async () => {
        await expect(
            lastValueFrom(bstore.meta(gspathDirectory + '/')),
        ).rejects.toThrow(/No such object/i);

        await expect(
            lastValueFrom(bstore.meta(gspathDirectory)),
        ).rejects.toThrow(/No such object/i);
    });

    it('blob', async () => {
        const expected = fs.readFileSync('test/data/sample.pdf.txt', {
            encoding: 'utf8',
        });
        const data = await lastValueFrom(bstore.read(gspathSampleFile));
        expect(data.toString('base64')).toEqual(expected);
    });

    it('retrieve', async () => {
        const obs = bstore.retrieve(gspathSampleFile);
        const result = await lastValueFrom(obs);

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
        const publicPath = gspathDirectory;

        // Note: file.name and file.metadata.name are equivalent
        //       used metadata to show that it's available for use
        const obs = bstore
            .getFiles(publicPath)
            .pipe(map((file) => file.metadata.name));

        const result = await allValuesFrom(obs);
        expect(result).toEqual(['public/man-join.txt', 'public/sample.pdf']);
    });

    it('processFiles', async () => {
        const publicPath = gspathDirectory;

        const obs = bstore.processFiles(publicPath, (file) => file.name);

        const result = await allValuesFrom(obs);
        expect(result).toEqual(['public/man-join.txt', 'public/sample.pdf']);
    });

    it('processFiles calls action for each file (covers map)', async () => {
        const publicPath = gspathDirectory;
        const localBstore = new BStoreRx();

        // Mock getFiles to emit two files
        const files: any[] = [
            { name: 'public/a.txt', metadata: { name: 'public/a.txt' } },
            { name: 'public/b.txt', metadata: { name: 'public/b.txt' } },
        ];
        jest.spyOn(localBstore, 'getFiles').mockImplementation(() => {
            const { Observable } = require('rxjs');
            return new Observable((subscriber: Subscriber<any>) => {
                files.forEach((f) => subscriber.next(f));
                subscriber.complete();
            });
        });
        const action = jest.fn((file) => file.name.toUpperCase());
        const obs = localBstore.processFiles(publicPath, action);
        const result = await allValuesFrom(obs);
        expect(result).toEqual(['PUBLIC/A.TXT', 'PUBLIC/B.TXT']);
        expect(action).toHaveBeenCalledTimes(2);
    });

    it('exists', (done) => {
        const testFile = `gs://${BUCKET_NAME}/public/file-does-not-exists.txt`;

        bstore.exists(testFile, 1, 2).subscribe({
            next: (value) => expect(value).toBeFalsy(),
            error(err) {
                throw err;
            },
            complete() {
                done();
            },
        });
    });

    it('createWriteableStream and delete', async () => {
        const testFile = `gs://${BUCKET_NAME}/test/test-bstorex-pe20L3csPl.txt`;
        const inputText = 'This is testFile for BStoreRx with data pe20L3csPl';

        const stream = bstore.createWriteableStream(testFile);
        stream.write(inputText);
        stream.end();

        // Need to wait until file exiss
        const meta = await lastValueFrom(
            bstore.exists(testFile).pipe(
                mergeMap((found) => {
                    if (found) {
                        return bstore.meta(testFile);
                    } else {
                        return throwError(() => {
                            throw new Error(`File ${testFile} not found`);
                        });
                    }
                }),
            ),
        );

        // console.log('# META', meta);
        expect(meta.size).toEqual('50');
        expect(meta.md5Hash).toEqual('APHDaTQ9kqp8Uk4ITMsRkw==');

        // Now delete the file
        await lastValueFrom(bstore.deleteFiles(testFile));

        const found = await lastValueFrom(bstore.exists(testFile));
        expect(found).toBeFalsy();
    });

    it('getFiles logs prefix and filters directories', async () => {
        const publicPath = gspathDirectory;
        const obs = bstore.getFiles(publicPath).pipe(map((file) => file.name));
        const result = await allValuesFrom(obs);
        expect(result.sort()).toEqual([
            'public/man-join.txt',
            'public/sample.pdf',
        ]);
    });

    it('deleteFiles logs prefix and handles no path error', () => {
        expect(() =>
            // @ts-expect-error purposely passing invalid object
            bstore.deleteFiles({ bucket: BUCKET_NAME }),
        ).toThrow(/Invalid gsuri passed to generateGsPath/);
    });
});
