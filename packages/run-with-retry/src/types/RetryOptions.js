// @flow

import type { RetryCondition } from "./RetryCondition";
import type { RetryStrategy } from "./RetryStrategy";

export type RetryOptions<Result> = {|
    retryCondition: RetryCondition<Result>,
    retryStrategy?: RetryStrategy,
    staggerRetries?: boolean,
    immediatelyRetry?: boolean,
|};
