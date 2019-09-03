// @flow

import type { RetryCondition, RetryOptions } from "run-with-retry";

// eslint-disable-next-line prettier/prettier
export type FetchRetryOptions = $Diff<RetryOptions<Response>, { retryCondition: RetryCondition<Response> }> & {
    retryCondition?: RetryCondition<Response>,
};
