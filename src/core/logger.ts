import { LoggerFactory } from 'jlog-facade';

const APP_NAME = 'gcutils';
const logger = LoggerFactory.create(APP_NAME);

/**
 * Create logger with name starting with project name.
 *
 * @param name
 * @returns
 */
export function createLogger(name?: string) {
    if (name === undefined) {
        return logger;
    } else {
        return LoggerFactory.create(`${APP_NAME}.${name}`);
    }
}
