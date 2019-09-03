// @flow

export type RetryCondition<Result> = (Result) => RetryConditionResult;
export type RetryConditionResult = boolean | Promise<boolean>;

export function foldRetryConditionResult(result: RetryConditionResult) {
    return function<Z>(b: (boolean) => Z, p: (Promise<boolean>) => Z): Z {
        if (typeof result === "boolean") {
            return b(result);
        } else if (result instanceof Promise) {
            return p(result);
        }

        (result: empty);
        throw new Error("Invalid state - unknown retry condition return type");
    };
}
