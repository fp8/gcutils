const DEFAULT_TIMER_NAME = 'iHZMBpJoQV-DNnEi47B7A';

export interface ITimeitResult<T> {
    result: T | undefined;
    elapsed: number;
}

export class Chrono {
    #timers: Record<string, [number, number]> = {};

    /**
     * Start timer, optionally giving it a name
     *
     * @param name
     * @returns
     */
    start(name = DEFAULT_TIMER_NAME): [number, number] {
        const start = process.hrtime();
        this.#timers[name] = start;
        return start;
    }

    /**
     * Return the elapsed in milliseconds since start was called.  Note that
     * this method does not clear the timer, so you can call it multiple times
     *
     * @param name
     * @returns
     */
    elapsed(name = DEFAULT_TIMER_NAME): number {
        const start = this.#timers[name];
        if (start) {
            const end = process.hrtime(start);
            const duration = computeElapsed(end); // Convert to milliseconds
            return duration;
        }
        return 0;
    }

    /**
     * Call the timeit method and log the elapsed time
     *
     * @param name
     */
    logit(name = DEFAULT_TIMER_NAME): number {
        const duration = this.elapsed(name);
        if (name === DEFAULT_TIMER_NAME) {
            console.log(`Timer elapsed time: ${duration} ms`);
        } else {
            console.log(`Timer [${name}] elapsed time: ${duration} ms`);
        }
        return duration;
    }

    /**
     * Clear the timer
     *
     * @param name
     */
    clear(name = DEFAULT_TIMER_NAME): void {
        delete this.#timers[name];
    }

    public async timeint<T>(
        action: () => T | undefined,
    ): Promise<ITimeitResult<T>> {
        const start = process.hrtime();
        const result = await action();
        const elapsed = process.hrtime(start);
        return { result, elapsed: computeElapsed(elapsed) };
    }
}

function computeElapsed(end: [number, number]) {
    return end[0] * 1000 + end[1] / 1e6;
}
