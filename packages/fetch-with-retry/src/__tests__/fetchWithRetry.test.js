// @flow

import runWithRetry from "run-with-retry";
import fetchWithRetry, { defaultRetryCondition } from "../fetchWithRetry";
import { chance } from "../../../../test-utils/retry-utils-chance";
import { coerceJestMock } from "../../../../test-utils/jest-mock";

jest.mock("run-with-retry", () => jest.fn());

describe("fetchWithRetry", () => {
    let url: string;
    let reqOptions: RequestOptions;
    let runWithRetryResult: Promise<Response>;

    beforeEach(() => {
        url = chance.url();
        reqOptions = { method: "POST" };
        runWithRetryResult = new Promise(() => {});
        coerceJestMock(runWithRetry).mockReturnValue(runWithRetryResult);
    });

    it("should return the result of runWithRetry", () => {
        expect(fetchWithRetry(url, reqOptions)).toBe(runWithRetryResult);
    });

    describe("no retry options provided", () => {
        it("should call runWithRetry with some function for run and the default retry options", () => {
            fetchWithRetry(url, reqOptions);

            expect(typeof coerceJestMock(runWithRetry).mock.calls[0][0]).toEqual("function");
            expect(coerceJestMock(runWithRetry).mock.calls[0][1]).toEqual({
                retryCondition: defaultRetryCondition,
            });
        });
    });

    describe("with retry options provided", () => {
        it("should call runWithRetry with some function for run and the provided retry options", () => {
            const retryOptions = {
                retryCondition: () => false,
                immediatelyRetry: chance.bool(),
                staggerRetries: chance.bool(),
            };
            fetchWithRetry(url, reqOptions, retryOptions);

            expect(typeof coerceJestMock(runWithRetry).mock.calls[0][0]).toEqual("function");
            expect(coerceJestMock(runWithRetry).mock.calls[0][1]).toEqual(retryOptions);
        });
    });

    describe("function passed to runWithRetry", () => {
        it("should fetch the provided url with options", () => {
            fetchWithRetry(url, reqOptions);

            const passedFunction = coerceJestMock(runWithRetry).mock.calls[0][0];
            passedFunction();

            expect(fetch).toHaveBeenCalledWith(url, reqOptions);
        });
    });
});
