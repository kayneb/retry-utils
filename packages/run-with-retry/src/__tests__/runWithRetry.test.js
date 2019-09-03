/* eslint-disable max-lines */
// @flow
import flushPromises from "../../../../test-utils/flushPromises";
import { chance, retryUtilsChance } from "../../../../test-utils/retry-utils-chance";
import type { RetryOptions } from "../types/RetryOptions";
import runWithRetry from "../runWithRetry";
import { DEFAULT_LINEAR_WAIT_TIME_MS } from "../strategies/linearRetryStrategy";
import {
    DEFAULT_MAXIMUM_WAIT_TIME_MS,
    DEFAULT_MULTIPLIER,
} from "../strategies/exponentialBackoffRetryStrategy";
import ExponentialBackoffRetryStrategy from "../strategies/ExponentialBackoffRetryStrategy";
import LinearRetryStrategy from "../strategies/LinearRetryStrategy";
import type { LinearRetryStrategyOptions } from "../strategies/LinearRetryStrategy";
import type { ExponentialBackoffRetryStrategyOptions } from "../strategies/ExponentialBackoffRetryStrategy";

type Success = { retry: false };
type Failure = { retry: true };
type Result = Success | Failure;

describe("runWithRetry", () => {
    let runs: Promise<Result>[];
    let run;
    let success: Success;
    let failure: Failure;
    let retryOptions: RetryOptions<Result>;

    beforeEach(() => {
        runs = [];
        run = jest.fn(() => {
            const [nextRun, ...remainingRuns] = runs;
            runs = remainingRuns;

            return nextRun || new Promise(() => {});
        });
        success = { retry: false };
        failure = { retry: true };

        retryOptions = retryUtilsChance.retryOptions({
            retryCondition: (r: Result) => r.retry,
        });

        jest.useFakeTimers();
        jest.clearAllMocks();
        jest.setTimeout(100);
    });

    // After some of the tests, there will sometimes still be setTimeouts or Promises waiting.
    // This ensures we completely flush them so that our mocks don't report additional interactions across test boundaries.
    afterEach(async () => {
        jest.clearAllTimers();
        await flushPromises();
    });

    function expectedDelayForNthRetryForExponentialBackoffStrategy(
        resolveMaximumWaitTimeMs: () => number,
        resolveMultiplier: () => number
    ) {
        return function(retryStrategyAttemptNumber: number) {
            // Subsequent retries are exponentially increasing, i.e. for defaults:
            // retry strategy #1 will occur after 1 min
            // retry strategy #2 will occur after 2 min
            // retry strategy #3 will occur after 4 min
            // retry strategy #4 will occur after 8 min
            // retry strategy #5 will occur after 16 min
            // retry strategy #6 will occur after 32 min
            // retry strategy #7 will occur after 60 min (maximum of 60 minutes)
            // retry strategy #8 will occur after 60 min (maximum of 60 minutes)
            return Math.min(
                Math.pow(resolveMultiplier(), retryStrategyAttemptNumber - 1) * 60 * 1000,
                resolveMaximumWaitTimeMs()
            );
        };
    }

    function advanceTimersByTimeForNthRetry(
        expectedDelayForNthRetry: (number) => number,
        retryStrategyAttemptNumber: number
    ) {
        jest.advanceTimersByTime(expectedDelayForNthRetry(retryStrategyAttemptNumber));
    }

    async function flushInitialRequestAndPreviousRetries(
        expectedDelayForNthRetry: (number) => number,
        retryStrategyAttemptNumber: number
    ) {
        // To flush the original run and any instant retries
        await flushPromises();

        // Will not include the current retry, i.e. when n < nthRetry
        for (let n = 1; n < retryStrategyAttemptNumber; n++) {
            advanceTimersByTimeForNthRetry(expectedDelayForNthRetry, n);
            // To flush the already resolved promise for this retry
            await flushPromises();
        }
    }

    const retryStrategyRunsToTest = 10;
    function generateRetryStrategyTests(
        currentRun: number,
        expectedDelayForNthRetry: (number) => number,
        retryStrategyAttemptNumber: number = 1
    ) {
        if (retryStrategyAttemptNumber > retryStrategyRunsToTest) {
            return;
        }

        describe(`retry #${retryStrategyAttemptNumber}`, () => {
            it("should not instantly retry", async () => {
                runWithRetry(run, retryOptions);

                await flushInitialRequestAndPreviousRetries(
                    expectedDelayForNthRetry,
                    retryStrategyAttemptNumber
                );

                expect(run.mock.calls.length).toBe(currentRun - 1);
            });

            describe(`after the delay for retry #${retryStrategyAttemptNumber} of strategy`, () => {
                it("should retry the run", async () => {
                    runWithRetry(run, retryOptions);

                    await flushInitialRequestAndPreviousRetries(
                        expectedDelayForNthRetry,
                        retryStrategyAttemptNumber
                    );
                    advanceTimersByTimeForNthRetry(
                        expectedDelayForNthRetry,
                        retryStrategyAttemptNumber
                    );

                    expect(run.mock.calls.length).toBe(currentRun);
                });

                describe(`when retry #${retryStrategyAttemptNumber} of strategy needs retrying`, () => {
                    beforeEach(() => {
                        runs = [...runs, Promise.resolve(failure)];
                    });

                    generateRetryStrategyTests(
                        currentRun + 1,
                        expectedDelayForNthRetry,
                        retryStrategyAttemptNumber + 1
                    );
                });

                describe(`when retry #${retryStrategyAttemptNumber} of strategy succeeds and doesn't meet retry condition`, () => {
                    beforeEach(() => {
                        runs = [...runs, Promise.resolve(success)];
                    });

                    it("should return the result of the success", async () => {
                        const promise = runWithRetry(run, retryOptions);

                        await flushInitialRequestAndPreviousRetries(
                            expectedDelayForNthRetry,
                            retryStrategyAttemptNumber
                        );
                        advanceTimersByTimeForNthRetry(
                            expectedDelayForNthRetry,
                            retryStrategyAttemptNumber
                        );

                        const r = await promise;

                        expect(r).toBe(success);
                    });
                });
            });
        });
    }

    function exponentialRetryStrategyTests(expectedNumberOfRunsSoFar: number) {
        let exponentialRetryStrategyOptions: ExponentialBackoffRetryStrategyOptions;

        beforeEach(() => {
            exponentialRetryStrategyOptions = Object.freeze({});
            retryOptions = {
                ...retryOptions,
                retryStrategy: new ExponentialBackoffRetryStrategy(exponentialRetryStrategyOptions),
            };
        });

        describe("staggerRetries is true", () => {
            beforeEach(() => {
                retryOptions = { ...retryOptions, staggerRetries: true };
            });

            describe("maximumWaitTimeMs is set", () => {
                let maximumWaitTimeMs;

                beforeEach(() => {
                    maximumWaitTimeMs = chance.natural({ min: 1, max: 2 * 60 * 60 * 1000 });
                    exponentialRetryStrategyOptions = {
                        ...exponentialRetryStrategyOptions,
                        maximumWaitTimeMs,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new ExponentialBackoffRetryStrategy(
                            exponentialRetryStrategyOptions
                        ),
                    };
                });

                describe("multiplier is set", () => {
                    let multiplier;

                    beforeEach(() => {
                        multiplier = chance.natural({ min: 2, max: 10 });
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        (retryStrategyAttemptNumber) => {
                            const delay = expectedDelayForNthRetryForExponentialBackoffStrategy(
                                () => maximumWaitTimeMs,
                                () => multiplier
                            )(retryStrategyAttemptNumber);

                            return delay + delay * 0.1;
                        }
                    );
                });

                describe("multiplier is not set", () => {
                    beforeEach(() => {
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier: undefined,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        (retryStrategyAttemptNumber) => {
                            const delay = expectedDelayForNthRetryForExponentialBackoffStrategy(
                                () => maximumWaitTimeMs,
                                () => DEFAULT_MULTIPLIER
                            )(retryStrategyAttemptNumber);

                            return delay + delay * 0.1;
                        }
                    );
                });
            });

            describe("maximumWaitTimeMs is not set", () => {
                beforeEach(() => {
                    exponentialRetryStrategyOptions = {
                        ...exponentialRetryStrategyOptions,
                        maximumWaitTimeMs: undefined,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new ExponentialBackoffRetryStrategy(
                            exponentialRetryStrategyOptions
                        ),
                    };
                });

                describe("multiplier is set", () => {
                    let multiplier;

                    beforeEach(() => {
                        multiplier = chance.natural({ min: 2, max: 10 });
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        (retryStrategyAttemptNumber) => {
                            const delay = expectedDelayForNthRetryForExponentialBackoffStrategy(
                                () => DEFAULT_MAXIMUM_WAIT_TIME_MS,
                                () => multiplier
                            )(retryStrategyAttemptNumber);

                            return delay + delay * 0.1;
                        }
                    );
                });

                describe("multiplier is not set", () => {
                    beforeEach(() => {
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier: undefined,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        (retryStrategyAttemptNumber) => {
                            const delay = expectedDelayForNthRetryForExponentialBackoffStrategy(
                                () => DEFAULT_MAXIMUM_WAIT_TIME_MS,
                                () => DEFAULT_MULTIPLIER
                            )(retryStrategyAttemptNumber);

                            return delay + delay * 0.1;
                        }
                    );
                });
            });
        });

        describe("staggerRetries is false", () => {
            beforeEach(() => {
                retryOptions = { ...retryOptions, staggerRetries: false };
            });

            describe("maximumWaitTimeMs is set", () => {
                let maximumWaitTimeMs;

                beforeEach(() => {
                    maximumWaitTimeMs = chance.natural({ min: 1, max: 2 * 60 * 60 * 1000 });
                    exponentialRetryStrategyOptions = {
                        ...exponentialRetryStrategyOptions,
                        maximumWaitTimeMs,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new ExponentialBackoffRetryStrategy(
                            exponentialRetryStrategyOptions
                        ),
                    };
                });

                describe("multiplier is set", () => {
                    let multiplier;

                    beforeEach(() => {
                        multiplier = chance.natural({ min: 2, max: 10 });
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        expectedDelayForNthRetryForExponentialBackoffStrategy(
                            () => maximumWaitTimeMs,
                            () => multiplier
                        )
                    );
                });

                describe("multiplier is not set", () => {
                    beforeEach(() => {
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier: undefined,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        expectedDelayForNthRetryForExponentialBackoffStrategy(
                            () => maximumWaitTimeMs,
                            () => DEFAULT_MULTIPLIER
                        )
                    );
                });
            });

            describe("maximumWaitTimeMs is not set", () => {
                beforeEach(() => {
                    exponentialRetryStrategyOptions = {
                        ...exponentialRetryStrategyOptions,
                        maximumWaitTimeMs: undefined,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new ExponentialBackoffRetryStrategy(
                            exponentialRetryStrategyOptions
                        ),
                    };
                });

                describe("multiplier is set", () => {
                    let multiplier;

                    beforeEach(() => {
                        multiplier = chance.natural({ min: 2, max: 10 });
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        expectedDelayForNthRetryForExponentialBackoffStrategy(
                            () => DEFAULT_MAXIMUM_WAIT_TIME_MS,
                            () => multiplier
                        )
                    );
                });

                describe("multiplier is not set", () => {
                    beforeEach(() => {
                        exponentialRetryStrategyOptions = {
                            ...exponentialRetryStrategyOptions,
                            multiplier: undefined,
                        };
                        retryOptions = {
                            ...retryOptions,
                            retryStrategy: new ExponentialBackoffRetryStrategy(
                                exponentialRetryStrategyOptions
                            ),
                        };
                    });

                    generateRetryStrategyTests(
                        expectedNumberOfRunsSoFar,
                        expectedDelayForNthRetryForExponentialBackoffStrategy(
                            () => DEFAULT_MAXIMUM_WAIT_TIME_MS,
                            () => DEFAULT_MULTIPLIER
                        )
                    );
                });
            });
        });
    }

    function linearRetryStrategyTests(expectedNumberOfRunsSoFar: number) {
        let linearRetryStrategyOptions: LinearRetryStrategyOptions;
        beforeEach(() => {
            linearRetryStrategyOptions = Object.freeze({});
            retryOptions = {
                ...retryOptions,
                retryStrategy: new LinearRetryStrategy(linearRetryStrategyOptions),
            };
        });

        describe("staggerRetries is true", () => {
            beforeEach(() => {
                retryOptions = { ...retryOptions, staggerRetries: true };
            });

            describe("waitTimeMs is set", () => {
                let waitTimeMs;

                beforeEach(() => {
                    waitTimeMs = chance.natural({ min: 1, max: 100000 });
                    linearRetryStrategyOptions = {
                        ...linearRetryStrategyOptions,
                        waitTimeMs,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new LinearRetryStrategy(linearRetryStrategyOptions),
                    };
                });

                generateRetryStrategyTests(expectedNumberOfRunsSoFar, () => {
                    return waitTimeMs + waitTimeMs * 0.1;
                });
            });

            describe("waitTimeMs is not set", () => {
                beforeEach(() => {
                    linearRetryStrategyOptions = {
                        ...linearRetryStrategyOptions,
                        waitTimeMs: undefined,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new LinearRetryStrategy(linearRetryStrategyOptions),
                    };
                });

                generateRetryStrategyTests(
                    expectedNumberOfRunsSoFar,
                    () => DEFAULT_LINEAR_WAIT_TIME_MS + DEFAULT_LINEAR_WAIT_TIME_MS * 0.1
                );
            });
        });

        describe("staggerRetries is false", () => {
            beforeEach(() => {
                retryOptions = { ...retryOptions, staggerRetries: false };
            });

            describe("waitTimeMs is set", () => {
                let waitTimeMs;

                beforeEach(() => {
                    waitTimeMs = chance.natural({ min: 1, max: 100000 });
                    linearRetryStrategyOptions = {
                        ...linearRetryStrategyOptions,
                        waitTimeMs,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new LinearRetryStrategy(linearRetryStrategyOptions),
                    };
                });
                generateRetryStrategyTests(expectedNumberOfRunsSoFar, () => {
                    return waitTimeMs + waitTimeMs * 0.1;
                });
            });

            describe("waitTimeMs is not set", () => {
                beforeEach(() => {
                    linearRetryStrategyOptions = {
                        ...linearRetryStrategyOptions,
                        waitTimeMs: undefined,
                    };
                    retryOptions = {
                        ...retryOptions,
                        retryStrategy: new LinearRetryStrategy(linearRetryStrategyOptions),
                    };
                });

                generateRetryStrategyTests(
                    expectedNumberOfRunsSoFar,
                    () => DEFAULT_LINEAR_WAIT_TIME_MS + DEFAULT_LINEAR_WAIT_TIME_MS * 0.1
                );
            });
        });
    }

    it("should attempt to run", () => {
        runWithRetry(run, retryOptions);

        expect(run.mock.calls.length).toBe(1);
    });

    describe("when initial run succeeds", () => {
        describe(`when run needs retrying`, () => {
            beforeEach(() => {
                runs = [...runs, Promise.resolve(failure)];
            });

            describe("when immediatelyRetry is true", () => {
                beforeEach(() => {
                    retryOptions = { ...retryOptions, immediatelyRetry: true };
                });

                it("should instantly retry the run", async () => {
                    runWithRetry(run, retryOptions);

                    await flushPromises();

                    expect(run.mock.calls.length).toBe(2);
                });

                describe("when immediate retry needs retrying", () => {
                    beforeEach(() => {
                        runs = [...runs, Promise.resolve(failure)];
                    });

                    describe("exponential backoff retry strategy", () => {
                        exponentialRetryStrategyTests(3);
                    });

                    describe("linear retry strategy", () => {
                        linearRetryStrategyTests(3);
                    });
                });
            });

            describe("when immediatelyRetry is false", () => {
                beforeEach(() => {
                    retryOptions = { ...retryOptions, immediatelyRetry: false };
                });

                describe("exponential backoff retry strategy", () => {
                    exponentialRetryStrategyTests(2);
                });

                describe("linear retry strategy", () => {
                    linearRetryStrategyTests(2);
                });
            });
        });

        describe("when run succeeds and doesn't meet retry condition", () => {
            beforeEach(() => {
                runs = [...runs, Promise.resolve(success)];
            });

            it("should return the result of the success", async () => {
                const r = await runWithRetry(run, retryOptions);

                expect(r).toBe(success);
            });
        });
    });
});
