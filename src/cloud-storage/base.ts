import * as nodePath from 'path';
import { Readable, Writable } from 'stream';
import { Observable } from 'rxjs';
import { isEmpty, JLogger } from 'jlog-facade';
import {
    Storage,
    File,
    CreateWriteStreamOptions,
    Bucket,
    StorageOptions,
} from '@google-cloud/storage';

import { GCUtilsError, createLogger } from '../core';

const logger = createLogger('cloud-storage.base');

/**
 * Attempt to replicate MetadataResponse that is not exported by '@google-cloud/storage'
 */
export type TMetaData = { [key: string]: unknown };

/**
 * Define the Google Cloud Storage protocal code
 */
export const BSTORE_PROTOCOL = 'gs:';

/**
 * Breakout a gs path to it's basic components:
 *
 * E.g.: gs://a-test-bucket/public/sample.pdf
 *
 * bucket: 'a-test-bucket'
 * path: 'public/sample.pdf'
 *
 * dirname: 'public'
 * filename: 'sample.pdf'
 *
 * basename: 'sample'
 * extname: '.pdf'
 *
 */
export interface IGsUri {
    /**
     * storage bucket name
     */
    bucket: string;
    /**
     * the path to the file
     */
    path: string;
    /**
     * directory of the path
     */
    dirname: string;
    /**
     * filename of the path
     */
    filename: string;
    /**
     * filename without extension
     */
    basename: string;
    /**
     * extension name
     */
    extname: string;
}

/**
 * Used by `BStore.retrieve` to return both metadata and data from the file
 */
export interface IRetrieveResult {
    /**
     * IGsUri of gspath
     */
    gs: IGsUri;
    /**
     * metadata of gspath
     */
    meta: TMetaData;
    /**
     * content of gspath as instance of Buffer
     */
    buffer: Buffer;
}

/**
 * Parse a Google Storage path, breaking it into componets
 * defined by [IGsUri] interface
 *
 * @param gspath Google Storage path
 */
export function parseGsPath(gspath: string): IGsUri {
    const uri = new URL(gspath);
    const hostname = uri.hostname;
    let path = uri.pathname || '';

    if (isEmpty(hostname) || typeof hostname !== 'string') {
        throw new Error('No valid host passed in path uri ' + gspath);
    }

    if (uri.protocol !== BSTORE_PROTOCOL) {
        throw new Error('Invalid protocol of "' + uri.protocol + '" detected');
    }

    // Strip leading '/' from path
    if (path.startsWith('/')) {
        path = path.substring(1);
    }

    // Break the path to it's components
    // eslint-disable-next-line prefer-const, @typescript-eslint/no-unused-vars
    let { root, dir, base, ext, name } = nodePath.parse(path);

    // If path is provided, the last part of the path shouldn't be considered as a file
    if (path.endsWith('/')) {
        name = '';
        dir = `${dir}/${base}`;
        base = '';
    }

    // Strip leading '/' from dirname
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }

    return {
        basename: name,
        bucket: hostname,
        dirname: dir,
        extname: ext,
        filename: base,
        path,
    };
}

/**
 * Create the IGsUri data structure based on bucket and file parts
 *
 * @param bucket
 * @param filepath
 * @param dirname
 * @returns
 */
export function generateGsUri(
    bucket: string,
    filepath: string,
    dirname?: string,
): IGsUri {
    let fullpath = '';

    // Using the path.join to handle scenario where dirname is passed and filepath also contains path
    if (dirname === undefined) {
        fullpath = filepath;
    } else {
        fullpath = nodePath.join(dirname, filepath);
    }

    // Break the filepath to it's basic components
    const { root: _ignore, dir, base, ext, name } = nodePath.parse(fullpath);

    // if filename is not provided, the dirname is sourced from the filepath components
    if (dirname === undefined) {
        dirname = dir;
    }

    return {
        basename: name,
        bucket,
        dirname: dirname,
        extname: ext,
        filename: base,
        path: fullpath,
    };
}

/**
 * Build the string path to Google Storage from a instance [IGsUri] object.
 *
 * Trapping error as this method is often used by this.logger
 *
 * @param gsuri
 */
export function generateGsPath(gsuri: IGsUri): string {
    if (isEmpty(gsuri) || isEmpty(gsuri.bucket) || isEmpty(gsuri.path)) {
        throw new Error(
            'Invalid gsuri passed to generateGsPath: ' + JSON.stringify(gsuri),
        );
    }

    // Create a new URL passig the path and hostname
    const url = new URL(gsuri.path, `${BSTORE_PROTOCOL}//${gsuri.bucket}`);
    return url.toString();
}

/**
 * The error callback used by the contractor of AbstractBStore
 */
export type TErrorCallback = (err: Error) => void;

/**
 * Default error handler for BStore used if no error handler is passed in the constructor.
 *
 * @param err
 */
const defaultErrorHandler: TErrorCallback = (err: Error): void => {
    const message =
        'Make sure to pass a specific ErrorHandler in the constructor of BStore';
    logger.error(`Unhandled error in BStore: ${err.message}.  ${message}`, err);
    // Error is not rethrown as it will be caught again by this error handler
};

/**
 * Options for the BStore classes
 */
export interface IBStoreOptions extends StorageOptions {
    errorHandler?: TErrorCallback;
}

/**
 * Abstract class for core methods of the Google Cloud Storage.
 *
 * NOTE: it's is critical to use the error handler callback on
 * the constructor or listen to `error` event when working with
 * reable or writeable streams.  Otherwise, any error will cause
 * node js' uncaughtException making error handling impossible.
 */
export abstract class AbstractBStore {
    /**
     * Flag to indicate if the error handler was set in the constructor
     * or not.  If not, the defaultErrorHandler will be used.
     */
    #errorHandlerSetInConstructor = false;

    /**
     * Optional instance of error handler
     */
    protected _errorHandler: TErrorCallback = defaultErrorHandler;

    /**
     * this.logger for BStore
     */
    protected abstract logger: JLogger;

    /**
     * Instance of Google Storage
     */
    readonly #storage: Storage;

    /**
     * Allow caller to pass errorHandler to handle the error event thrown
     * by Storage operations
     *
     * @param options
     */
    constructor(options?: IBStoreOptions) {
        this.#storage = new Storage(options);
        if (options?.errorHandler) {
            this.setErrorHandler(options.errorHandler);
        }
    }

    /**
     * Allow caller to set/replace the error handler callback.
     *
     * @param errorHandler
     */
    public setErrorHandler(errorHandler: TErrorCallback): void {
        this.#errorHandlerSetInConstructor = true;
        this._errorHandler = errorHandler;
    }

    /**
     * Return an instance of Google Cloud Storage File
     *
     * @param input
     * @returns
     */
    public blob(input: IGsUri | string): File {
        return this.getBlob(input);
    }

    /**
     * Return a reable stream.  Need to use the error callback in the constructor
     * or listen to the `error` event of the resulting Readable
     *
     * @param gspath
     * @returns
     */
    public createReadableStream(gspath: File | IGsUri | string): Readable {
        const stream = this.getBlob(gspath).createReadStream();

        stream.on('error', (err) => {
            const error = new GCUtilsError(err);
            const logMessage = `Reable error event for ${gspath}: ${error.message}`;
            // Only log if the error handler was set in the constructor incase caller doesn't log anything
            // If it's not set, the default error handler will log a warning
            if (this.#errorHandlerSetInConstructor) {
                this.logger.debug(logMessage);
            }
            this._errorHandler(error);
        });

        return stream;
    }

    /**
     * Return a writable stream.  Need to use the error callback in the constructor
     * or listen to the `error` event of the resulting Readable
     *
     * @param gspath
     */
    public createWriteableStream(
        gspath: File | IGsUri | string,
        options?: CreateWriteStreamOptions,
    ): Writable {
        const stream = this.getBlob(gspath).createWriteStream(options);

        stream.on('error', (err) => {
            const error = new GCUtilsError(err);
            const logMessage = `Wriable error event for ${gspath}: ${error.message}`;
            // Only log if the error handler was set in the constructor incase caller doesn't log anything
            // If it's not set, the default error handler will log a warning
            if (this.#errorHandlerSetInConstructor) {
                this.logger.debug(logMessage);
            }
            this._errorHandler(error);
        });

        return stream;
    }

    public getBucket(bucketName: string): Bucket {
        return this.#storage.bucket(bucketName);
    }

    /**
     * Expose the Google Cloud Storage instance
     */
    public get storage(): Storage {
        return this.#storage;
    }

    /**
     * Get instance of Google Cloud Storage File from a string.  If a File
     * is passed, simply return that instance.
     *
     * @param input Google Storage path or instance of File
     */
    protected getBlob(input: File | IGsUri | string): File {
        if (input instanceof File) {
            this.logger.debug(
                () =>
                    `.getBlob bucket=${input.bucket.name};path=${input.name} [FILE]`,
            );
            return input;
        } else if (typeof input === 'string') {
            const gs = parseGsPath(input);
            this.logger.debug(
                () => `.getBlob bucket=${gs.bucket};path=${gs.path} [${input}]`,
            );
            return this.getBucket(gs.bucket).file(gs.path);
        } else {
            this.logger.debug(
                () =>
                    `.getBlob bucket=${JSON.stringify(input.bucket)};path=${input.path}`,
            );
            return this.getBucket(input.bucket).file(input.path);
        }
    }
}

/**
 * Async methods of BStore returning promise
 */
export interface IBStorePromise {
    meta(input: File | IGsUri | string): Promise<TMetaData>;
    exists(
        input: File | IGsUri | string,
        waitFor: number,
        maxRetry: number,
    ): Promise<boolean>;
    read(input: File | IGsUri | string): Promise<Buffer>;
    retrieve(input: string): Promise<IRetrieveResult>;
    getFiles(input: IGsUri | string): Promise<File[]>;
    processFiles<T>(
        gspath: IGsUri | string,
        action: (file: File) => Promise<T>,
    ): Promise<T[]>;
    deleteFiles(gspath: IGsUri | string): Promise<void>;
}

/**
 * Async methods of BStore returning Observable
 */
export interface IBStoreRxJx {
    meta(input: File | IGsUri | string): Observable<TMetaData>;
    exists(
        input: File | IGsUri | string,
        waitFor: number,
        maxRetry: number,
    ): Observable<boolean>;
    read(input: File | IGsUri | string): Observable<Buffer>;
    retrieve(input: string): Observable<IRetrieveResult>;
    getFiles(input: IGsUri | string): Observable<File>;
    processFiles<T>(
        gspath: IGsUri | string,
        action: (file: File) => T,
    ): Observable<T>;
    deleteFiles(gspath: IGsUri | string): Observable<never>;
}
