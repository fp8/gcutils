import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { createLogger } from '../core';
import { Loggable, isEmpty } from 'jlog-facade';

const logger = createLogger('SecretsService');

const secretNameFromPathRegex = new RegExp(
    '^projects\\/\\S+\\/secrets\\/(\\S+)$',
);

export interface ISecretNameVersion {
    name: string;
    version: string;
}

/**
 * Service to access secrets from Google Secret Manager.  The secret must be loaded
 * upon initialization of the service.  The name of the secret consist of name of the
 * secret and optionally the version of the secret separated by a pipe `|`.
 *
 * * <secret-name>[|<version>]
 *
 *
 */
export class SecretsService {
    static readonly PROVIDER_NAME = SecretsService.name;

    /**
     * An async factory for SecretsService that will populate with desire secrets
     *
     * @param secrets
     * @returns
     */
    static async create(...secrets: string[]): Promise<SecretsService> {
        const out = new SecretsService();
        await out.loadSecrets(...secrets);
        return out;
    }

    public gcloudProjectId: string | undefined;
    protected client = new SecretManagerServiceClient();
    protected secretStore: Map<string, string> = new Map();

    /**
     * Must use .create factory method to create a new instance
     */
    protected constructor() {}

    protected async loadSecrets(...secrets: string[]): Promise<void> {
        this.gcloudProjectId = await this.client.getProjectId();
        await this.populateSecretStore(...secrets);
    }

    /**
     * Retrieve the secret loaded during creation of the service with the
     * secret name as the string of secret provided.
     *
     * @param secret
     * @param defaultIfNull
     * @returns
     */
    public get(secret: string, defaultIfNull?: string): string {
        let secretValue = this.secretStore.get(secret);
        if (secretValue === undefined) {
            if (defaultIfNull === undefined) {
                throw new Error(
                    `Failed to retrieve secret ${secret} from Secret Manager`,
                );
            } else {
                secretValue = defaultIfNull;
            }
        }

        return secretValue;
    }

    /**
     * Wrapper around SecretManagerServiceClient.listSecrets returning all secrets in a map
     * with the key as the secret name and value as the secret path.
     *
     * @returns
     */
    public async listSecrets(): Promise<Record<string, string>> {
        const result: Record<string, string> = {};

        const parent = `projects/${this.gcloudProjectId}`;
        const [secrets] = await this.client.listSecrets({ parent });

        if (secrets === null || secrets === undefined) {
            logger.debug(
                '[SecretsService] failed to list secret as listSecrets returned null',
            );
            return {};
        }

        for (const secret of secrets) {
            if (secret.name) {
                const name = parseSecretNameFromSecretPath(secret.name);
                if (name !== undefined) {
                    result[name] = secret.name;
                } else {
                    logger.debug(
                        `[SecretsService] failed to list secret as parsing of the name failed for ${secret}`,
                    );
                }
            } else {
                logger.debug(
                    '[SecretsService] failed to list secret as secret.name is undefined for secret entry',
                    Loggable.of('SecretServiceEntry', secret),
                );
            }
        }

        return result;
    }

    /**
     * Wrapper around SecretManagerServiceClient.accessSecretVersion to retrieve a spefici version of a secret.
     *
     * This method support both the secrete name and version using pipe (eg: 'mySecret|1') or an object with
     * name and version properties.  If a simple secret name is provided, the version is set to `latest`.
     *
     * @param secret a secret name or an object with name and version properties
     * @returns
     */
    public async accessSecretVersion(
        secret: string | ISecretNameVersion,
    ): Promise<string | undefined> {
        const secretPath = getSecretPathFromSecretNameVersion(
            this.gcloudProjectId,
            secret,
        );
        const [accessResponse] = await this.client.accessSecretVersion({
            name: secretPath,
        });
        return accessResponse?.payload?.data?.toString();
    }

    /**
     * Return entire store of secrets
     */
    public get store(): Map<string, string> {
        return this.secretStore;
    }

    /**
     * Load list of secret provided.  If no secret provided, skip loading.
     *
     * @param secrets
     * @returns
     */
    protected async populateSecretStore(...secrets: string[]): Promise<void> {
        const result: Promise<void>[] = [];

        if (secrets.length === 0) {
            return;
        }

        // Retrieve all secrets asynchronously by adding the promise to the result array
        for (const secret of secrets) {
            const accessPromise = this.accessSecretVersion(secret).then(
                (secretData) => {
                    if (secretData !== undefined) {
                        logger.info(
                            `[SecretsService] Secret loaded: ${secret}`,
                        );
                        this.secretStore.set(secret, secretData);
                    }
                },
            );
            result.push(accessPromise);
        }

        return Promise.all(result).then(() => {
            // pass
        });
    }
}

/**
 * Parse secret name from path
 *
 * @param secretPath
 * @returns
 */
export function parseSecretNameFromSecretPath(
    secretPath: string,
): string | undefined {
    const match = secretNameFromPathRegex.exec(secretPath);
    if (match && match.length > 1) {
        return match[1];
    } else {
        return undefined;
    }
}

/**
 * Return a name and version pair from a secretName.  The secretName contains both the name and the
 * version separated by a pipe `|`.  If the version is not provided, the version is set to `latest`.
 *
 * @param secret
 * @returns
 */
export function parseSecretNameToNameVersion(
    secret: string | ISecretNameVersion,
): ISecretNameVersion {
    let name: string;
    let version: string;

    // Parse the input params
    if (typeof secret === 'string') {
        if (secret.includes('|')) {
            [name, version] = secret.split('|', 2);
        } else {
            name = secret;
            version = 'latest';
        }
    } else {
        name = secret.name;
        version = secret.version;
    }

    // Validate result
    if (isEmpty(name)) {
        throw new Error('[SecretsService] Secret name cannot be empty');
    }
    if (isEmpty(version)) {
        throw new Error(
            `[SecretsService] Secret version cannot be empty for name ${name}`,
        );
    }

    return { name, version };
}

/**
 * Return secret path from secretName
 *
 * @param projectId
 * @param secret
 * @returns
 */
export function getSecretPathFromSecretNameVersion(
    projectId: string | undefined,
    secret: string | ISecretNameVersion,
): string {
    if (isEmpty(projectId)) {
        throw new Error('[SecretsService] projectId cannot be empty');
    }
    const { name, version } = parseSecretNameToNameVersion(secret);
    return `projects/${projectId}/secrets/${name}/versions/${version}`;
}
