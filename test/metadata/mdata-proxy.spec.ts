import '../testlib';

import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

import { fetcher } from '@fp8proj/core';
import { GCloudMetadata } from '@fp8proj/metadata';

const PROJECT_ID = process.env.GCUTILS_GOOGLE_CLOUD_PROJECT;
const PROJECT_NUMBER = process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER;
const GCUTILS_METADATA_PROXY_URL = process.env.GCUTILS_METADATA_PROXY_URL;

/**
 * Repeat the test by calling A GCloudMetadata proxy setup as a cloud run service.
 *
 * Skip this test if you don't have a proxy service to metadata.google.internal
 */
describe('GCloudMetadata', () => {
    let metadata: GCloudMetadata;

    // Ensure environment variables are set
    beforeAll(async () => {
        if (!process.env.FP8_FETCH_TOKEN) {
            const token = await executeShellCommand(
                'gcloud auth print-identity-token',
            );
            if (token) {
                process.env.FP8_FETCH_TOKEN = token;
            }
        }

        expect(process.env.GCUTILS_GOOGLE_CLOUD_PROJECT).toBeDefined();
        expect(process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER).toBeDefined();
        expect(process.env.GCUTILS_METADATA_PROXY_URL).toBeDefined();
        expect(process.env.FP8_FETCH_TOKEN).toBeDefined();
    });

    beforeEach(async () => {
        metadata = new GCloudMetadata(GCUTILS_METADATA_PROXY_URL);
        await metadata.initialize();
    });

    describe('get method', () => {
        it('make metadata are fetched correctly', async () => {
            expect(metadata.projectId).toBe(PROJECT_ID);
            expect(metadata.getNumericProjectId()).resolves.toBe(
                PROJECT_NUMBER,
            );
            expect(metadata.getRegion()).resolves.toBe('europe-west1');
            expect(metadata.getZone()).resolves.toBe('europe-west1-1');
            expect(metadata.getServiceAccountEmail()).resolves.toBe(
                `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`,
            );
        });
        it('Makes sure that accessToken can be fetched and it is valid', async () => {
            // Fetch the access token
            const tokenText = await metadata.getAccessToken();
            expect(tokenText).toBeDefined();
            const tokenJson = JSON.parse(tokenText!);
            const token = tokenJson.access_token;
            expect(token).toBeDefined();

            // Validate
            const validationUrl = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`;
            const validation: any = await fetchJson(validationUrl);
            // console.log('validation:', validation);

            expect(validation).toBeDefined();
            expect(validation!.email).toBe(
                `${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`,
            );
        });
        it('should fetch metadata from the correct URL', async () => {
            const result = await metadata.get(
                'computeMetadata/v1/project/project-id',
            );
            expect(result).toBe(PROJECT_ID);
        });
    });
});

/**
 * Simple wrapper to run the shell command and return result
 *
 * @param command
 * @returns
 */
async function executeShellCommand(command: string): Promise<string> {
    const out = await exec(command);
    return out.stdout;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetcher(url);
    return JSON.parse(response);
}
