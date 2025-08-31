/* istanbul ignore file */

import { Observable } from 'rxjs';

/**
 * Cache the entry in an array and return as Promise
 *
 * @param obj
 * @returns
 */
export async function allValuesFrom<T>(obj: Observable<T>): Promise<T[]> {
    const result: T[] = [];
    return new Promise((resolve, reject) => {
        obj.subscribe({
            next(entry) {
                result.push(entry);
            },
            error(err) {
                reject(err);
            },
            complete() {
                resolve(result);
            },
        });
    });
}

/*
This file should be ignored for testing purposes
*/
