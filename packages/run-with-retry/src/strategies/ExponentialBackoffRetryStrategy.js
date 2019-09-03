// @flow

export const DEFAULT_MAXIMUM_WAIT_TIME_MS = 60 * 60 * 1000;
const DEFAULT_INITIAL_WAIT_TIME = 60 * 1000;
export const DEFAULT_MULTIPLIER = 2;

export type ExponentialBackoffRetryStrategyOptions = {|
    +maximumWaitTimeMs?: number,
    +multiplier?: number,
|};

export default class ExponentialBackoffRetryStrategy {
    maximumWaitTimeMs: number;
    multiplier: number;

    constructor({ maximumWaitTimeMs, multiplier }: ExponentialBackoffRetryStrategyOptions = {}) {
        this.maximumWaitTimeMs = maximumWaitTimeMs || DEFAULT_MAXIMUM_WAIT_TIME_MS;
        this.multiplier = multiplier || DEFAULT_MULTIPLIER;
    }

    resolveNextWaitTime(previousWaitTimeMs: number) {
        return Math.min(
            previousWaitTimeMs === 0
                ? DEFAULT_INITIAL_WAIT_TIME
                : previousWaitTimeMs * this.multiplier,
            this.maximumWaitTimeMs
        );
    }
}
