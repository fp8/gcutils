import exp from 'constants';
import { expect } from '../testlib';

import {
    parseSecretNameToNameVersion,
    parseSecretNameFromSecretPath,
    SecretsService,
} from '@fp8proj/secret-manager';

const PROJECT_ID = process.env.GCUTILS_GOOGLE_CLOUD_PROJECT;
const PROJECT_NUMBER = process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER;

describe('secret-manager.gsecrets', () => {
    // Ensure environment variables are set
    beforeAll(() => {
        expect(process.env.GCUTILS_GOOGLE_CLOUD_PROJECT).toBeDefined();
        expect(process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER).toBeDefined();
    });

    describe('parseSecretNameToNameVersion', () => {
        it('should parse secret when it is a string without version', () => {
            const secret = 'mySecret';
            const result = parseSecretNameToNameVersion(secret);
            expect(result).toEqual({ name: 'mySecret', version: 'latest' });
        });

        it('should parse secret when it is a string with version', () => {
            const secret = 'mySecret|1';
            const result = parseSecretNameToNameVersion(secret);
            expect(result).toEqual({ name: 'mySecret', version: '1' });
        });

        it('should parse secret when it is an object', () => {
            const secret = { name: 'mySecret', version: '1' };
            const result = parseSecretNameToNameVersion(secret);
            expect(result).toEqual(secret);
        });

        it('should throw error when secret name is empty', () => {
            const secret = '';
            expect(() => parseSecretNameToNameVersion(secret)).toThrow(
                '[SecretsService] Secret name cannot be empty',
            );
        });

        it('should throw error when secret version is empty', () => {
            const secret = { name: 'mySecret', version: '' };
            expect(() => parseSecretNameToNameVersion(secret)).toThrow(
                `[SecretsService] Secret version cannot be empty for name ${secret.name}`,
            );
        });
    });

    it('parseSecretNameFromSecretPath', () => {
        const paths = [
            {
                path: `projects/${PROJECT_NUMBER}/secrets/gcutils-utest-secret`,
                expected: 'gcutils-utest-secret',
            },
            {
                path: `projects/${PROJECT_NUMBER}/secrets/fp8sql11_ciphervox-dev`,
                expected: 'fp8sql11_ciphervox-dev',
            },
            {
                path: 'whatever',
                expected: undefined,
            },
        ];

        for (const path of paths) {
            const secret = parseSecretNameFromSecretPath(path.path);
            expect(secret).toBe(path.expected);
        }
    });

    it('create', async () => {
        const secrets = ['gcutils-utest-secret', 'gcutils-utest-secret|1'];
        const gsecret = await SecretsService.create(...secrets);

        expect(gsecret).toBeDefined();
        expect(gsecret.gcloudProjectId).toBe(PROJECT_ID);

        // console.log('### store', gsecret.store);
        expect(gsecret.store.size).toBe(2);
        expect(gsecret.get('gcutils-utest-secret')).toBe('secret-PkTnXo69zU');
        expect(gsecret.get('gcutils-utest-secret|1')).toBe('secret-EQBR9B0nSF');
    });

    it('listSecrets', async () => {
        const gsecret = await SecretsService.create();
        const list = await gsecret.listSecrets();
        expect(list).toBeDefined();
        expect(list).toMatchObject({
            'gcutils-utest-secret': `projects/${PROJECT_NUMBER}/secrets/gcutils-utest-secret`,
        });
    });

    it('accessSecretVersion', async () => {
        const gsecret = await SecretsService.create();
        const value = await gsecret.accessSecretVersion('gcutils-utest-secret');
        expect(value).toBe('secret-PkTnXo69zU');

        const value2 = await gsecret.accessSecretVersion(
            'gcutils-utest-secret|1',
        );
        expect(value2).toBe('secret-EQBR9B0nSF');

        const value3 = await gsecret.accessSecretVersion({
            name: 'gcutils-utest-secret',
            version: '2',
        });
        expect(value3).toBe('secret-PkTnXo69zU');

        const value4 = await gsecret.accessSecretVersion({
            name: 'gcutils-utest-secret',
            version: '1',
        });
        expect(value4).toBe('secret-EQBR9B0nSF');
    });
});
