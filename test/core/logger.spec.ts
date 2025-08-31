import { createLogger } from '../../src/core/logger';

describe('createLogger', () => {
    it('should return the default logger when no name is provided', () => {
        const logger = createLogger();
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(logger['name']).toBe('gcutils'); // Assuming the default logger has this name
    });

    it('should return a named logger when a name is provided', () => {
        const name = 'test';
        const namedLogger = createLogger(name);
        expect(namedLogger).toBeDefined();
        expect(typeof namedLogger.info).toBe('function');
        // We cannot access the logger name directly, so just check it is a logger instance
        expect(namedLogger['name']).toBe('gcutils.test');
    });
});
