// @flow

import handleResultAndRetryIfNeeded from "./utils/handleResultAndRetryIfNeeded";
import runAfter, { runAfterWithStagger } from "./runAfter";
import type { RetryOptions } from "./types/RetryOptions";
import LinearRetryStrategy from "./strategies/LinearRetryStrategy";
import type { RetryStrategy } from "./types/RetryStrategy";

export default function runWithRetry<Result>(
    run: () => Promise<Result>,
    retryOptions: RetryOptions<Result>
): Promise<Result> {
    return handleResultAndRetryIfNeeded(run(), retryOptions.retryCondition, () =>
        immediatelyRetryOrBeginRetryStrategy(run, retryOptions)
    );
}
function immediatelyRetryOrBeginRetryStrategy<Result>(
    run: () => Promise<Result>,
    retryOptions: RetryOptions<Result>
): Promise<Result> {
    if (retryOptions.immediatelyRetry) {
        return handleResultAndRetryIfNeeded(run(), retryOptions.retryCondition, () =>
            recursivelyRetryWithStrategy(run, retryOptions)
        );
    }

    return recursivelyRetryWithStrategy(run, retryOptions);
}

const defaultRetryStrategy: RetryStrategy = new LinearRetryStrategy();

function recursivelyRetryWithStrategy<Result>(
    run: () => Promise<Result>,
    retryOptions: RetryOptions<Result>
): Promise<Result> {
    const retryStrategy = retryOptions.retryStrategy || defaultRetryStrategy;

    return recursivelyRetryWithStrategyInner(
        run,
        retryOptions,
        retryStrategy.resolveNextWaitTime(0),
        retryStrategy
    );
}

function runAfterMaybeWithStagger<Result>(
    run: () => Promise<Result>,
    retryOptions: RetryOptions<Result>,
    waitTimeMs: number
): Promise<Result> {
    if (retryOptions.staggerRetries) {
        return runAfterWithStagger(run, waitTimeMs);
    }

    return runAfter(run, waitTimeMs);
}

function recursivelyRetryWithStrategyInner<Result>(
    run: () => Promise<Result>,
    retryOptions: RetryOptions<Result>,
    waitTimeMs: number,
    retryStrategy: RetryStrategy
): Promise<Result> {
    return handleResultAndRetryIfNeeded(
        runAfterMaybeWithStagger(run, retryOptions, waitTimeMs),
        retryOptions.retryCondition,
        () =>
            recursivelyRetryWithStrategyInner(
                run,
                retryOptions,
                retryStrategy.resolveNextWaitTime(waitTimeMs),
                retryStrategy
            )
    );
}
