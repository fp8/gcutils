import { localDebug } from 'jlog-facade';

interface IGaxiosErrorEntry {
    message: string;
    domain: string;
    reason: string;
}

interface IGaxiosErrorContent {
    code: number;
    message: string;
    errors: IGaxiosErrorEntry[];
}

interface IGaxiosError {
    error: IGaxiosErrorContent;
}

/**
 * Parse the input string as json
 *
 * @param input
 * @returns
 */
function safeJsonParse<T>(input: string): T | undefined {
    try {
        return JSON.parse(input);
    } catch (_err) {
        localDebug(`Failed to parse ${input} as JSON`, 'gcutils.safeJsonParse');
        return undefined;
    }
}

/**
 * Translate the GaxiosError raised by Google SDK from a JSON
 * to a normal error with string based message
 *
 * @param err
 * @returns
 */
export function translateGaxiosError(err: unknown): {
    errorMessage: string;
    error: Error;
} {
    if (err instanceof Error) {
        // In case GaxiosError is not detected
        const errorMessage = err.message;
        if (errorMessage.startsWith('{')) {
            const parsed = safeJsonParse<IGaxiosError>(errorMessage);
            return {
                errorMessage: parsed?.error?.message ?? errorMessage,
                error: err,
            };
        } else {
            return { errorMessage, error: err };
        }
    } else {
        // This shouldn't happen
        const errorMessage = `${err}`;
        return { errorMessage: errorMessage, error: new Error(`${err}`) };
    }
}

/**
 * A GCUtils specific error.  Allow creation from an existing
 * error.  If input error is GaxiosError, translate from a
 * json error message to a string message.
 */
export class GCUtilsError extends Error {
    // Override cause to be an instance of Error
    public readonly cause: Error | undefined = undefined;
    constructor(input: string | Error, cause?: unknown) {
        if (input instanceof Error) {
            const { errorMessage: message, error } =
                translateGaxiosError(input);
            if (error) {
                super(message, { cause: error });
                this.cause = error;
            } else {
                super(message);
            }
        } else {
            if (cause instanceof Error) {
                super(input, { cause });
                this.cause = cause;
            } else {
                super(input);
            }
        }
        this.name = GCUtilsError.name;
    }
}

/**
 * An error designed to be used with retry method forcing
 * a retry despite an error
 */
export class RetryError extends Error {
    // Override cause to be an instance of Error
    public readonly cause: Error | undefined = undefined;
    constructor(message: string, cause?: unknown) {
        if (cause instanceof Error) {
            super(message, { cause });
            this.cause = cause;
        } else {
            super(message, { cause });
        }
        this.name = RetryError.name;
    }
}

/**
 * An error designed to be used with RxJs' retry method.
 *
 * Note: not sure if anyone is using this method so deprecating instead of deleting
 *
 * @deprecated Use RetryError instead
 */
export class RxJsRetryError extends RetryError {
    // Override cause to be an instance of Error
    public readonly cause: Error | undefined = undefined;
    constructor(message: string, cause?: unknown) {
        super(message, cause);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.name = RxJsRetryError.name;
    }
}
