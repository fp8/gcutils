import { Chrono } from '../testlib';
import * as dns from 'node:dns';

import { METADATA_HOST } from '@fp8proj/metadata';

/**
 * A simple Promise wrapper around dns.resolve
 *
 * @param hostname
 * @returns
 */
async function dnsResolve(hostname: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        dns.resolve(hostname, (err, addresses) => {
            if (err) {
                reject(err);
            } else {
                resolve(addresses);
            }
        });
    });
}

describe('net', () => {
    const chrono = new Chrono();

    it('should resolve a domain name', async () => {
        chrono.start();
        const addresses = await dnsResolve('example.com');
        const duration = chrono.elapsed();
        expect(duration).toBeLessThan(50); // expected around 24 ms
        expect(addresses).toBeDefined();
    });

    it('bad domain name', async () => {
        chrono.start();
        await expect(dnsResolve('4OgOjxBP9j-Wa2pqXwuOJ.com')).rejects.toThrow(
            'queryA ENOTFOUND 4OgOjxBP9j-Wa2pqXwuOJ.com',
        );
        const duration = chrono.elapsed();
        expect(duration).toBeLessThan(100); // expected around 24 ms
    });

    it('metadata host check', async () => {
        chrono.start();
        await expect(dnsResolve(METADATA_HOST)).rejects.toThrow(
            'queryA ENOTFOUND metadata.google.internal',
        );
        const duration = chrono.elapsed();
        expect(duration).toBeLessThan(100); // expected around 24 ms
    });

    test.each([
        {
            url: 'http://metadata.google.internal/computeMetadata/v1/instance/zone',
            hostname: METADATA_HOST,
            host: METADATA_HOST,
        },
        {
            url: 'http://localhost:8081',
            hostname: 'localhost',
            host: 'localhost:8081',
        },
    ])('Get hostname from url', async ({ url, hostname, host }) => {
        const testUrl = new URL(url);
        expect(testUrl.hostname).toBe(hostname);
        expect(testUrl.host).toBe(host);
    });

    it('Joining URL', () => {
        const base = 'http://localhost:8080';
        const relative = 'api/KJOLrszWTo';
        const joined = new URL(relative, base);
        expect(joined.href).toBe('http://localhost:8080/api/KJOLrszWTo');
    });
});
