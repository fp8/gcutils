import '../testlib';
import { GCloudMetadata } from '../../src/metadata';
import * as helper from '../../src/core/helper';

const PROJECT_NUMBER = process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER;

// Mock the fetcher function
jest.mock('../../src/core/helper', () => ({
    ...jest.requireActual('../../src/core/helper'),
    fetcher: jest.fn(),
}));

const mockFetch = helper.fetcher as jest.MockedFunction<typeof helper.fetcher>;

async function createTestMetadataInstance(
    baseUrl?: string,
): Promise<GCloudMetadata> {
    const instance = new GCloudMetadata(baseUrl);
    await instance.initialize('0udIIiWVT6.YjAGt1VJZG.Odf4kcT9iy.3Ajq9oGLKN');
    return instance;
}

describe('GCloudMetadata', () => {
    let metadata: GCloudMetadata;
    const originalEnv = process.env;
    const mockProjectId = 'test-project-123';

    // Ensure environment variables are set
    beforeAll(() => {
        expect(process.env.GCUTILS_GOOGLE_CLOUD_PROJECT_NUMBER).toBeDefined();
    });

    beforeEach(async () => {
        // Reset environment variables
        process.env = { ...originalEnv };
        delete process.env.METADATA_DISABLED;
        delete process.env.FP8_ENV;
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_REGION;
        delete process.env.GOOGLE_CLOUD_ZONE;

        // Set just the project ID env
        process.env.GOOGLE_CLOUD_PROJECT_ID = mockProjectId;

        // Create fresh instance
        metadata = await createTestMetadataInstance();

        // Reset mocks
        mockFetch.mockReset();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('constructor', () => {
        it('should initialize with default metadata server URL', () => {
            const instance = new GCloudMetadata();
            expect(instance).toBeInstanceOf(GCloudMetadata);
        });

        it('should initialize with custom base URL', () => {
            const customUrl = 'http://custom-metadata-server';
            const instance = new GCloudMetadata(customUrl);
            expect(instance).toBeInstanceOf(GCloudMetadata);
        });

        it('should initialize with custom metadata proxy URL', () => {
            const customProxyUrl = `https://metadata-proxy-lc-${PROJECT_NUMBER}.europe-west1.run.app`;
            const instance = new GCloudMetadata(customProxyUrl);
            expect(instance).toBeInstanceOf(GCloudMetadata);
        });
    });

    describe('get method', () => {
        it('SHould not be inGCloud', () => {
            expect(metadata.inGCloud).toBe(true);
        });

        it('should fetch metadata from the correct URL', async () => {
            const mockResponse = 'test-project-id';
            mockFetch.mockResolvedValue(mockResponse);

            const result = await metadata.get(
                'computeMetadata/v1/project/project-id',
            );

            expect(mockFetch).toHaveBeenCalledWith(
                'http://metadata.google.internal/computeMetadata/v1/project/project-id',
                { 'Metadata-Flavor': 'Google' },
            );
            expect(result).toBe(mockResponse);
        });

        it('should handle numeric responses', async () => {
            const mockResponse = '123456789';
            mockFetch.mockResolvedValue(mockResponse);

            const result = await metadata.get(
                'computeMetadata/v1/project/numeric-project-id',
            );

            expect(result).toBe('123456789');
        });

        it('should handle empty responses', async () => {
            mockFetch.mockResolvedValue('');

            const result = await metadata.get(
                'computeMetadata/v1/project/project-id',
            );

            expect(result).toBe('');
        });

        it('should propagate fetch errors', async () => {
            const error = new Error('Network error');
            mockFetch.mockRejectedValue(error);

            await expect(
                metadata.get('computeMetadata/v1/project/project-id'),
            ).rejects.toThrow('Network error');
        });
    });

    describe('projectId property', () => {
        it('should fetch project ID from metadata server', async () => {
            expect(metadata.projectId).toBe(mockProjectId);
        });

        it('should return undefined if no environment variable is configured and fetch fails', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await metadata.getNumericProjectId();

            expect(result).toBeUndefined();
        });
    });

    describe('numericProjectId property', () => {
        it('should fetch numeric project ID from metadata server', async () => {
            const mockNumericId = '123456789';
            mockFetch.mockResolvedValue(mockNumericId);

            const result = await metadata.getNumericProjectId();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id',
                { 'Metadata-Flavor': 'Google' },
            );
            expect(result).toBe(mockNumericId);
        });

        it('should return undefined in local environment when no env var is configured', async () => {
            process.env.FP8_ENV = 'local';

            const result = await metadata.getNumericProjectId();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });
    });

    describe('region property', () => {
        it('should fetch and parse region from metadata server', async () => {
            const mockRegionPath = 'projects/123456789/regions/us-central1';
            mockFetch.mockResolvedValue(mockRegionPath);

            const result = await metadata.getRegion();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://metadata.google.internal/computeMetadata/v1/instance/region',
                { 'Metadata-Flavor': 'Google' },
            );
            expect(result).toBe('us-central1');
        });

        it('should use environment variable when in local mode', async () => {
            process.env.FP8_ENV = 'local-dev';
            process.env.GOOGLE_CLOUD_REGION = 'europe-west1';

            const result = await metadata.getRegion();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result).toBe('europe-west1');
        });

        it('should return undefined if regex does not match', async () => {
            const invalidRegionPath = 'invalid-format';
            mockFetch.mockResolvedValue(invalidRegionPath);

            const result = await metadata.getRegion();

            expect(result).toBeUndefined();
        });

        it('should fallback to environment variable on fetch error', async () => {
            process.env.GOOGLE_CLOUD_REGION = 'fallback-region';
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await metadata.getRegion();

            expect(result).toBe('fallback-region');
        });
    });

    describe('zone property', () => {
        it('should fetch and parse zone from metadata server', async () => {
            const mockZonePath = 'projects/123456789/zones/us-central1-a';
            mockFetch.mockResolvedValue(mockZonePath);

            const result = await metadata.getZone();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://metadata.google.internal/computeMetadata/v1/instance/zone',
                { 'Metadata-Flavor': 'Google' },
            );
            expect(result).toBe('us-central1-a');
        });

        it('should use environment variable when metadata is disabled', async () => {
            process.env.METADATA_DISABLED = 'true';
            process.env.GOOGLE_CLOUD_ZONE = 'europe-west1-b';

            const result = await metadata.getZone();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result).toBe('europe-west1-b');
        });

        it('should return undefined if regex does not match', async () => {
            const invalidZonePath = 'invalid-zone-format';
            mockFetch.mockResolvedValue(invalidZonePath);

            const result = await metadata.getZone();

            expect(result).toBeUndefined();
        });
    });

    describe('serviceAccountEmail property', () => {
        it('should fetch service account email from metadata server', async () => {
            const mockEmail = 'test-service@project.iam.gserviceaccount.com';
            mockFetch.mockResolvedValue(mockEmail);

            const result = await metadata.getServiceAccountEmail();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
                { 'Metadata-Flavor': 'Google' },
            );
            expect(result).toBe(mockEmail);
        });

        it('should return undefined in local environment', async () => {
            process.env.METADATA_DISABLED = 'true';

            const result = await metadata.getServiceAccountEmail();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should return undefined on fetch failure since no env fallback is configured', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await metadata.getServiceAccountEmail();

            expect(result).toBeUndefined();
        });
    });

    describe('fetchMetadata method', () => {
        it('should throw error for invalid metadata key', async () => {
            // Access the protected method via casting
            const metadataInstance = metadata as any;

            await expect(
                metadataInstance.fetchMetadata('invalidKey'),
            ).rejects.toThrow(
                'Invalid metadata key invalidKey passed to GCloudMetadata.fetchMetadata.',
            );
        });

        it('should handle multiple FP8_ENV local variations', async () => {
            const localEnvs = ['local', 'local-dev', 'local-test', 'localhost'];

            for (const envValue of localEnvs) {
                process.env.FP8_ENV = envValue;
                process.env.GOOGLE_CLOUD_PROJECT_ID = 'local-project';

                // Reset for each test
                const mdata = await createTestMetadataInstance();

                mockFetch.mockReset();

                const result = mdata.projectId;
                expect(mockFetch).not.toHaveBeenCalled();
                expect(result).toBe('local-project');
            }
        });
    });

    describe('caching behavior', () => {
        it('should cache results across different method calls for the same metadata', async () => {
            const mockProjectNumber = '11661234';
            mockFetch.mockResolvedValue(mockProjectNumber);

            // First call
            const result1 = await metadata.getNumericProjectId();
            // Second call
            const result2 = await metadata.getNumericProjectId();
            // Third call to ensure cache persists
            const result3 = await metadata.getNumericProjectId();

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toBe(mockProjectNumber);
            expect(result2).toBe(mockProjectNumber);
            expect(result3).toBe(mockProjectNumber);
        });

        it('should cache undefined values', async () => {
            process.env.METADATA_DISABLED = 'true';
            // No environment variable set for numeric project ID

            // First call
            const result1 = await metadata.getNumericProjectId();
            // Second call
            const result2 = await metadata.getNumericProjectId();

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result1).toBeUndefined();
            expect(result2).toBeUndefined();
        });

        it('should not interfere between different metadata types', async () => {
            const mockProjectNumber = '50610852';
            const mockRegion = 'projects/50610852/regions/us-west1';

            mockFetch
                .mockResolvedValueOnce(mockProjectNumber)
                .mockResolvedValueOnce(mockRegion);

            const projectResult = await metadata.getNumericProjectId();
            const regionResult = await metadata.getRegion();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(projectResult).toBe(mockProjectNumber);
            expect(regionResult).toBe('us-west1');
        });
    });

    describe('custom base URL', () => {
        it('should use custom base URL for requests', async () => {
            const customMetadata = await createTestMetadataInstance(
                'http://custom-metadata.local',
            );

            const mockResponse = 'custom-project';
            mockFetch.mockResolvedValue(mockResponse);
            await customMetadata.getNumericProjectId();

            expect(mockFetch).toHaveBeenCalledWith(
                'http://custom-metadata.local/computeMetadata/v1/project/numeric-project-id',
                { 'Metadata-Flavor': 'Google' },
            );
        });
    });

    describe('edge cases', () => {
        it('should handle empty string responses', async () => {
            mockFetch.mockResolvedValue('');

            const result = await metadata.getZone();

            expect(result).toBe('');
        });

        it('should handle string responses from fetch', async () => {
            mockFetch.mockResolvedValue(
                'projects/50631952/zones/us-KM434ucQd1-d',
            );

            const result = await metadata.getZone();

            expect(result).toBe('us-KM434ucQd1-d');
        });

        it('should handle text responses from fetch', async () => {
            mockFetch.mockResolvedValue(
                'projects/35049063/regions/us-bx8Ouz4Jzr',
            );

            const result = await metadata.getRegion();

            expect(result).toBe('us-bx8Ouz4Jzr');
        });
    });
});
