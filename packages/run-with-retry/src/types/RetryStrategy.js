// @flow

export type RetryStrategy = { +resolveNextWaitTime: (previousWaitTimeMs: number) => number };
