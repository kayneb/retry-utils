// @flow

export const DEFAULT_LINEAR_WAIT_TIME_MS = 60 * 1000;

export type LinearRetryStrategyOptions = {|
    waitTimeMs?: number,
|};

export default class LinearRetryStrategy {
    waitTimeMs: number;

    constructor({ waitTimeMs }: LinearRetryStrategyOptions = {}) {
        this.waitTimeMs = waitTimeMs || DEFAULT_LINEAR_WAIT_TIME_MS;
    }

    resolveNextWaitTime() {
        return this.waitTimeMs;
    }
}
