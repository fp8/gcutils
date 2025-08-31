import { createLogger, fetcher, checkIfHostResolves } from '../core'; // Ensure helper is imported for side effects

const logger = createLogger('metadata');

// Secret used to force the GCloudMetadata client to assume it is running in Google Cloud
const FORCE_IN_GCLOUD_SECRET = '0udIIiWVT6.YjAGt1VJZG.Odf4kcT9iy.3Ajq9oGLKN';

export const METADATA_HOST = 'metadata.google.internal';
const DEFAULT_METADATA_URL = `http://${METADATA_HOST}`;

export interface ICachedMetadata {
    projectId?: string; // GOOGLE_CLOUD_PROJECT
    numericProjectId?: string;
    region?: string; // Expected: projects/<project_number>/regions/<region>
    zone?: string; // Expected: projects/<project_number>/zones/<zone>
    serviceAccountEmail?: string;
    accessToken?: string;
}

interface IMetadataConfigEntry {
    path: string;
    env?: string[]; // Environment variable to use if metadata server is not available
    regex?: RegExp; // Optional regex to parse the value
}

type TMetadataConfig = {
    [key in keyof ICachedMetadata]: IMetadataConfigEntry;
};

/**
 * Configure alternative metadata sources from config
 *
 * ref: https://cloud.google.com/run/docs/container-contract#metadata-server
 */
const config: TMetadataConfig = {
    projectId: {
        path: 'computeMetadata/v1/project/project-id',
        env: ['GOOGLE_CLOUD_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT'],
    },
    numericProjectId: {
        path: 'computeMetadata/v1/project/numeric-project-id',
        env: ['GOOGLE_CLOUD_PROJECT_NUMBER'],
    },
    region: {
        path: 'computeMetadata/v1/instance/region',
        env: ['GOOGLE_CLOUD_REGION'],
        regex: /^projects\/\d+\/regions\/(.+)$/,
    },
    zone: {
        path: 'computeMetadata/v1/instance/zone',
        env: ['GOOGLE_CLOUD_ZONE'],
        regex: /^projects\/\d+\/zones\/(.+)$/,
    },
    serviceAccountEmail: {
        path: 'computeMetadata/v1/instance/service-accounts/default/email',
    },
    accessToken: {
        path: '/computeMetadata/v1/instance/service-accounts/default/token',
    },
};

/**
 * GCloudMetadata class to fetch and cache metadata from the Google Cloud Metadata server.
 */
export class GCloudMetadata {
    #initialized = false;
    #inGCloud = false;
    #projectId: string | undefined;
    #baseUrl: string;
    #cache: ICachedMetadata = {};

    constructor(baseUrl: string = DEFAULT_METADATA_URL) {
        this.#baseUrl = baseUrl;
        logger.debug(
            `GCloudMetadata initialized with base URL: ${this.#baseUrl}`,
        );
    }

    /**
     * Initialize the metadata client.
     *
     * N.B.: `forceInGCloudSecret` is used to bypass the check for whether the code is running in Google Cloud
     *       for unit testing only.
     *
     * @param forceInGCloudSecret Pass the secret to force the client to assume it is running in Google Cloud.
     */
    public async initialize(forceInGCloudSecret?: string): Promise<void> {
        if (!this.#initialized) {
            // Check if we are running in Google Cloud by resolving the metadata host
            if (forceInGCloudSecret === FORCE_IN_GCLOUD_SECRET) {
                this.#inGCloud = true;
            } else {
                this.#inGCloud = await checkIfHostResolves(
                    new URL(this.#baseUrl),
                );
            }

            // Pre-fetch metadata values if in Google Cloud
            const projectId = await this.rawFetchMetadata('projectId');
            if (projectId === undefined) {
                throw new Error('Failed to fetch project ID');
            }
            this.#projectId = projectId;

            // Set initialized flag
            this.#initialized = true;
        }
    }

    /**
     * Sync methods
     */
    public get inGCloud(): boolean {
        this.checkInitialization();
        return this.#inGCloud;
    }

    /**
     * Get the project ID.
     */
    public get projectId(): string {
        this.checkInitialization();

        // private projectId shouldn't be undefined as it's checked in the .initialize
        if (this.#projectId === undefined) {
            throw new Error('Project ID not found');
        }
        return this.#projectId;
    }

    /**
     * Fetch metadata from a path on the metadata server.  This method should only be called if .inGCloud
     * is true.  If not, it will always return undefined.
     *
     * @param path The path to fetch from the metadata server.
     * @returns A promise that resolves to the metadata value.
     */
    async get(path: string): Promise<string | undefined> {
        if (this.#inGCloud) {
            const url = `${this.#baseUrl}/${path}`;
            logger.info(
                `[GCloudMetadata.get] Fetching metadata from URL: ${url}`,
            );
            const resp = await fetcher(url, { 'Metadata-Flavor': 'Google' });
            return resp;
        } else {
            return undefined;
        }
    }

    public getNumericProjectId(): Promise<string | undefined> {
        return this.fetchMetadata('numericProjectId');
    }
    public getRegion(): Promise<string | undefined> {
        return this.fetchMetadata('region');
    }
    public getZone(): Promise<string | undefined> {
        return this.fetchMetadata('zone');
    }
    public getServiceAccountEmail(): Promise<string | undefined> {
        return this.fetchMetadata('serviceAccountEmail');
    }
    public getAccessToken(): Promise<string | undefined> {
        return this.fetchMetadata('accessToken');
    }

    /**
     * Make sure that .initialize has been called.
     */
    protected checkInitialization(): void {
        if (!this.#initialized) {
            throw new Error('GCloudMetadata not initialized');
        }
    }

    /**
     * Check if we should call the metadata server.
     *
     * @returns True if we are in Google Cloud and not disabled, false otherwise.
     */
    private toCallMetadataServer(): boolean {
        if (
            process.env.METADATA_DISABLED ||
            process.env.FP8_ENV?.startsWith('local')
        ) {
            return false;
        }
        return this.#inGCloud;
    }

    /**
     * Version of fetchMetadata that ensure that class has been initialized
     *
     * @param key
     * @returns
     */
    protected async fetchMetadata(
        key: keyof ICachedMetadata,
    ): Promise<string | undefined> {
        this.checkInitialization();
        return this.rawFetchMetadata(key);
    }

    /**
     * A protected method to fetch metadata based on key provided in the config
     *
     * @param key
     * @returns
     */
    protected async rawFetchMetadata(
        key: keyof ICachedMetadata,
    ): Promise<string | undefined> {
        // Make sure that key has a corresponding entry in the config
        const entry = config[key];
        if (!entry) {
            throw new Error(
                `Invalid metadata key ${key} passed to GCloudMetadata.fetchMetadata.`,
            );
        }

        // Return cached value if available
        if (this.#cache[key] !== undefined) {
            logger.debug(`Returning cached metadata for ${key}`);
            return this.#cache[key];
        }

        // Environment variable always takes precedence
        let result = readFromEnv(entry);

        // Attempt call to metadata server only if required
        if (this.toCallMetadataServer()) {
            // Try to fetch from metadata server
            try {
                const value = await this.get(entry.path);
                if (entry.regex && value) {
                    logger.debug(
                        `Parsing metadata value for ${key} with regex: ${entry.regex}`,
                    );
                    const match = value.match(entry.regex);
                    result = match ? match[1] : undefined;
                } else if (value !== undefined) {
                    result = value;
                } else {
                    logger.debug(
                        `No valid metadata found for ${key}, falling back to env variable(s) ${entry.env}`,
                    );
                }
            } catch (err) {
                const message = `Failed to fetch metadata for ${key} from ${this.#baseUrl}/${entry.path}`;
                const error =
                    err instanceof Error ? err : new Error(String(err));
                if (result === undefined) {
                    logger.error(`${message}: ${error.message}`, error);
                } else {
                    logger.error(
                        `${message}: ${error.message}.  Falling back to use env variable(s) ${entry.env}`,
                        error,
                    );
                }
            }
        }
        // Cache the result if set
        if (result === undefined) {
            delete this.#cache[key]; // Ensure cache is cleared if result is undefined
        } else {
            this.#cache[key] = result;
        }
        return result;
    }
}

function readFromEnv(entry: IMetadataConfigEntry): string | undefined {
    if (entry.env) {
        for (const envVar of entry.env) {
            const value = process.env[envVar];
            if (value !== undefined) {
                logger.debug(`Found environment variable ${envVar}: ${value}`);
                return value;
            }
        }
    }
    return undefined;
}
