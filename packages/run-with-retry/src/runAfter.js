// @flow

export default function runAfter<Result>(
    run: () => Promise<Result>,
    waitTimeMs: number
): Promise<Result> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            run()
                .then(resolve)
                .catch(reject);
        }, waitTimeMs);
    });
}

export function runAfterWithStagger<Result>(
    run: () => Promise<Result>,
    waitTimeMs: number
): Promise<Result> {
    const maxStagger = waitTimeMs * 0.1;
    const staggerDelay = Math.random() * maxStagger;

    return runAfter(run, waitTimeMs + staggerDelay);
}
