// @flow

import { foldRetryConditionResult } from "../types/RetryCondition";
import type { RetryCondition } from "../types/RetryCondition";

export default async function handleResultAndRetryIfNeeded<Result>(
    result: Promise<Result>,
    retryCondition: RetryCondition<Result>,
    retry: () => Promise<Result>
): Promise<Result> {
    return result
        .then((r: Result) => {
            return foldRetryConditionResult(retryCondition(r))(
                (b) => {
                    return handleMustRetryResult(r, retry)(b);
                },
                (deferredMustRetry) => deferredMustRetry.then(handleMustRetryResult(r, retry))
            );
        })
        .catch(retry);
}

function handleMustRetryResult<Result>(
    result: Result,
    retry: () => Promise<Result>
): (boolean) => Promise<Result> {
    return function(mustRetry: boolean): Promise<Result> {
        return mustRetry ? retry() : Promise.resolve(result);
    };
}
