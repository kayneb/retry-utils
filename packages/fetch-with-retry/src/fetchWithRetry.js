// @flow

import runWithRetry from "run-with-retry";
import type { FetchRetryOptions } from "./types/FetchRetryOptions";

export const defaultRetryCondition = (r: Response) => r.status >= 500 && r.status <= 599;

export default function fetchWithRetry(
    input: RequestInfo,
    reqOptions?: RequestOptions,
    retryOptions?: FetchRetryOptions
): Promise<Response> {
    return runWithRetry(() => fetch(input, reqOptions), {
        retryCondition: defaultRetryCondition,
        ...retryOptions,
    });
}
