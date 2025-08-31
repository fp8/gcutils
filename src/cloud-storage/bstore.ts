import {
    File,
    GetFilesOptions,
    DeleteFilesOptions,
} from '@google-cloud/storage';

import { createLogger, retry } from '../core';
import {
    TMetaData,
    IGsUri,
    IRetrieveResult,
    parseGsPath,
    generateGsPath,
    AbstractBStore,
    IBStorePromise,
} from './base';

/**
 * Simple wrapper for Google Storage with support for `gs://` style path
 */
export class BStore extends AbstractBStore implements IBStorePromise {
    static readonly PROVIDER_NAME = BStore.name;

    /**
     * this.logger for BStore
     */
    override logger = createLogger(BStore.name);

    /**
     * Return a meta data of a Google Storage File
     *
     * @param input Google Storage path or instance of File
     */
    public async meta(input: File | IGsUri | string): Promise<TMetaData> {
        const blob = this.getBlob(input);
        const [meta] = await blob.getMetadata();
        return meta;
    }

    /**
     * Wait until provided file exists.  Default wait time is 200ms and maxRetry is 10
     *
     * @param input
     * @param waitFor
     * @param maxRetry
     * @returns
     */
    public async exists(
        input: File | IGsUri | string,
        waitFor = 200,
        maxRetry = 10,
    ): Promise<boolean> {
        const file = this.getBlob(input);
        const resp = await retry(
            () => file.exists().then((entries) => entries[0]),
            { waitFor, maxRetry },
        );
        return resp ?? false;
    }

    /**
     * Return a Buffer with data from a Google Storage File
     *
     * @param input Google Storage path or instance of File
     */
    public read(input: File | IGsUri | string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            try {
                this.createReadableStream(input)
                    .on('data', (chunk: Buffer) => chunks.push(chunk))
                    .on('error', (err: Error) => reject(err))
                    .on('end', () => resolve(Buffer.concat(chunks)));
            } catch (err) {
                this.logger.warn(`Failed on to read ${input}`, err as Error);
                reject(err);
            }
        });
    }

    /**
     * Return meta and content of file from a given gs path
     *
     * @param input Google Storage path
     */
    public async retrieve(input: string): Promise<IRetrieveResult> {
        const gs = parseGsPath(input);
        const blob = this.getBlob(input);

        const [meta, buffer] = await Promise.all([
            this.meta(blob),
            this.read(blob),
        ]);
        return { gs, meta, buffer };
    }

    /**
     * Return a list of files from a path excluding the directories
     *
     * @param input
     */
    public getFiles(input: IGsUri | string): Promise<File[]> {
        let gs: IGsUri;
        if (typeof input === 'string') {
            gs = parseGsPath(input);
        } else {
            gs = input;
        }
        const options: GetFilesOptions = {};

        // Filter the result from the path provided.
        if (gs.path) {
            this.logger.debug(
                `Setting BStore.getFiles option.prefix to ${gs.path}`,
            );
            options.prefix = gs.path;
        }

        // .getFiles for somereason returns Files wraps in an array.  Need to return first result only
        const bucket = this.getBucket(gs.bucket);
        return bucket
            .getFiles(options)
            .then((result) => {
                if (Array.isArray(result) && result.length) {
                    return result[0];
                } else {
                    return [];
                }
            })
            .then((files: File[]) => {
                // Filter out directories
                return files.filter((file: File) => !file.name.endsWith('/'));
            });
    }

    /**
     * Process all files return for a given path via an action callback
     *
     * @param gspath path to get files from
     * @param action file processor
     */
    public processFiles<T>(
        gspath: IGsUri | string,
        action: (file: File) => Promise<T>,
    ): Promise<T[]> {
        return this.getFiles(gspath).then((files: File[]) => {
            const actions: Array<Promise<T>> = [];

            for (const file of files) {
                actions.push(action(file));
            }

            // Wait for all actions result before proceeding
            return Promise.all(actions);
        });
    }

    public deleteFiles(gspath: IGsUri | string): Promise<void> {
        let gs: IGsUri;
        if (typeof gspath === 'string') {
            gs = parseGsPath(gspath);
        } else {
            gs = gspath;
        }

        // Do not stop at the first error; try to delete what it can
        const options: DeleteFilesOptions = {
            force: true,
        };

        // Filter the result from the path provided.
        if (gs.path) {
            this.logger.debug(
                `Setting BStore.deleteFiles option.prefix to ${gs.path}`,
            );
            options.prefix = gs.path;
        } else {
            throw new Error(
                `A directory must be passed to BStore.deleteFiles [${generateGsPath(gs)}]`,
            );
        }

        // .getFiles for somereason returns Files wraps in an array.  Need to return first result only
        const bucket = this.getBucket(gs.bucket);

        return bucket.deleteFiles(options);
    }
}
