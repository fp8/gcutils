import {
    File,
    GetFilesOptions,
    DeleteFilesOptions,
} from '@google-cloud/storage';
import {
    Observable,
    of,
    from,
    map,
    forkJoin,
    mergeMap,
    retry,
    catchError,
    throwError,
} from 'rxjs';
import { isArray } from 'jlog-facade';

import { createLogger } from '../core';
import {
    TMetaData,
    IGsUri,
    IRetrieveResult,
    parseGsPath,
    generateGsPath,
    AbstractBStore,
    IBStoreRxJx,
} from './base';

const RETRY_ERROR = 'Retry Error ID aVMFH2aUsC';

/**
 * Simple wrapper for Google Storage with support for `gs://` style path
 * returning observables
 */
export class BStoreRx extends AbstractBStore implements IBStoreRxJx {
    static readonly PROVIDER_NAME = BStoreRx.name;

    /**
     * this.logger for BStore
     */
    override logger = createLogger(BStoreRx.name);

    /**
     * Return a meta data of a Google Storage File
     *
     * @param input Google Storage path or instance of File
     */
    public meta(input: File | IGsUri | string): Observable<TMetaData> {
        const blob = this.getBlob(input);
        return new Observable((subscriber) => {
            blob.getMetadata((err: Error | null, metadata?: TMetaData) => {
                if (err instanceof Error) {
                    subscriber.error(err);
                } else if (metadata !== undefined) {
                    subscriber.next(metadata);
                }
                subscriber.complete();
            })?.catch((err) => {
                /*
                ToDo: Remove .catch with new types when available
                
                There seems to be a problem with typescript with current typings used.  Without
                this .catch, eslint throws error: "Promises must be awaited, end with a call to .catch ..."
                */
                subscriber.error(err);
            });
        });
    }

    /**
     * Check if file exists, retries 3 times every 50 ms by default.
     *
     * @param input
     * @param waitFor
     * @param maxRetry
     * @returns
     */
    public exists(
        input: File | IGsUri | string,
        waitFor = 50,
        maxRetry = 3,
    ): Observable<boolean> {
        const file = this.getBlob(input);

        const retryConfig = {
            count: maxRetry,
            delay: waitFor,
        };

        // In order for retry to work, promise must be recreated
        function checkIfExists(): Observable<boolean> {
            return from(
                new Promise<boolean>((resolve, reject) => {
                    return file.exists().then((exists) => {
                        if (exists.length && exists[0]) {
                            resolve(true);
                        } else {
                            reject(RETRY_ERROR);
                        }
                    });
                }),
            );
        }

        return of(false).pipe(
            mergeMap(() => checkIfExists()),
            retry(retryConfig),
            catchError((err: unknown) => {
                if (err === RETRY_ERROR) {
                    return of(false);
                } else {
                    return throwError(() => {
                        throw err;
                    });
                }
            }),
        );
    }

    /**
     * Return a Buffer with data from a Google Storage File
     *
     * @param input Google Storage path or instance of File
     */
    public read(input: File | IGsUri | string): Observable<Buffer> {
        const chunks: Buffer[] = [];

        return new Observable((subscriber) => {
            try {
                this.createReadableStream(input)
                    .on('data', (chunk: Buffer) => chunks.push(chunk))
                    .on('error', (error: unknown) => subscriber.error(error))
                    .on('end', () => {
                        subscriber.next(Buffer.concat(chunks));
                        subscriber.complete();
                    });
            } catch (err) {
                this.logger.warn(`Failed on to read ${input}`, err as Error);
                subscriber.error(err);
            }
        });
    }

    /**
     * Return meta and content of file from a given gs path
     *
     * @param input Google Storage path
     */
    public retrieve(input: string): Observable<IRetrieveResult> {
        const blob = this.getBlob(input);
        return forkJoin({
            gs: of(parseGsPath(input)),
            meta: from(this.meta(blob)),
            buffer: this.read(blob),
        });
    }

    /**
     * Return a list of files from a path excluding the directories
     *
     * @param input
     */
    public getFiles(input: IGsUri | string): Observable<File> {
        let gs: IGsUri;
        if (typeof input === 'string') {
            gs = parseGsPath(input);
        } else {
            gs = input;
        }

        // Filter the result from the path provided.
        const options: GetFilesOptions = {};
        if (gs.path) {
            this.logger.debug(
                `Setting BStore.getFiles option.prefix to ${gs.path}`,
            );
            options.prefix = gs.path;
        }

        // .getFiles for some reason returns Files wraps in an array.  Need to return first result only
        const bucket = this.getBucket(gs.bucket);

        return new Observable((subscriber) => {
            const stream = bucket.getFilesStream(options);

            stream.on('error', (err) => subscriber.error(err));
            stream.on('end', () => subscriber.complete());
            stream.on('data', (file) => {
                // Filter out directories
                if (!file.name.endsWith('/')) {
                    subscriber.next(file);
                }
            });
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
        action: (file: File) => T,
    ): Observable<T> {
        return this.getFiles(gspath).pipe(map((file) => action(file)));
    }

    public deleteFiles(gspath: IGsUri | string): Observable<never> {
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

        return new Observable((subscriber) => {
            bucket.deleteFiles(options, (err: Error | Error[] | null) => {
                if (err instanceof Error) {
                    subscriber.error(err);
                } else if (isArray(err)) {
                    // ToDo: Check if this actually works
                    err.map((error) => subscriber.error(error));
                } else {
                    // send an entry entry then complete.  Without .next will raise an error
                    subscriber.next(undefined as never);
                    subscriber.complete();
                }
            });
        });
    }
}
