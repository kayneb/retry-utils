// @flow

import Chance from "chance";
import type { RetryOptions } from "../packages/run-with-retry/src";
import type { RetryStrategy } from "../packages/run-with-retry/src/types/RetryStrategy";
import type { RetryCondition } from "../packages/run-with-retry/src/types/RetryCondition";
import LinearRetryStrategy from "../packages/run-with-retry/src/strategies/LinearRetryStrategy";
import ExponentialBackoffRetryStrategy from "../packages/run-with-retry/src/strategies/ExponentialBackoffRetryStrategy";

const seed = Math.floor(Math.random() * 10000000);

// eslint-disable-next-line no-console
console.log("Chance seed:", seed);

export const chance = new Chance(seed);

export const retryUtilsChance = {
    linearRetryStrategy: function linearRetryStrategy(): LinearRetryStrategy {
        return new LinearRetryStrategy({
            ...(chance.bool() ? { waitTimeMs: chance.natural({ max: 100000 }) } : {}),
        });
    },
    exponentialBackoffRetryStrategy: function exponentialBackoffRetryStrategy(): ExponentialBackoffRetryStrategy {
        return new ExponentialBackoffRetryStrategy({
            ...(chance.bool()
                ? { maximumWaitTimeMs: chance.natural({ min: 1, max: 2 * 60 * 60 * 1000 }) }
                : {}),
            ...(chance.bool() ? { multiplier: chance.natural({ min: 1, max: 4 }) } : {}),
        });
    },
    retryStrategy: function retryStrategy(): RetryStrategy {
        return chance.pickone([
            retryUtilsChance.linearRetryStrategy(),
            retryUtilsChance.exponentialBackoffRetryStrategy(),
        ]);
    },
    retryOptions: function retryOptions<A>({
        retryCondition,
    }: {
        retryCondition: RetryCondition<A>,
    }): RetryOptions<A> {
        return {
            retryCondition,
            ...(chance.bool() ? { retryStrategy: retryUtilsChance.retryStrategy() } : {}),
            ...(chance.bool() ? { staggerRetries: chance.bool() } : {}),
            ...(chance.bool() ? { immediatelyRetry: chance.bool() } : {}),
        };
    },
};
