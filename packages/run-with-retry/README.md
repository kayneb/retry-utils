# run-with-retry
run-with-retry is a JavaScript library for wrapping asynchronous functions in a retry mechanism.

This package exports a few utilities, and associated configuration:

* `runWithRetry` - a utility for providing retry behaviour to the provided async function
* `runAfter` - a simple Promise wrapper around `setTimeout` that delays execution of the provided function until the wait time has elapsed.  

## How to install
The library is available as an npm package. To install the package run:

```
npm install run-with-retry --save
# or with yarn 
yarn add run-with-retry
 ```
 
## How to use

### runWithRetry
Runs the provided `run` function immediately, and if it fails it retries, as defined by the `retryOptions`.

`runWithRetry<Result>(run: () => Promise<Result>, retryOptions: RetryOptions): Promise<Result>`

#### Example

```js
import runWithRetry from "run-with-retry";

const resolveValue: () => Promise<Response> = () => fetch(url);

runWithRetry(resolveValue, { immediatelyRetry: true, retryCondition: (r: Response) = r.ok })
```

### runAfter
Simple wrapper around setTimeout, delaying execution of the provided function.

`runAfter<Result>(run: () => Promise<Result>, waitTimeMs: number): Promise<Result>`

#### Example

```js
import{ runAfter } from "run-with-retry";

const run: () => Promise<string> = () => {
    console.log("Run!");
    return Promise.resolve("Hello world!");
};

runAfter(run, 1000).then(console.log);

// After 1000ms, "Run!" is printed, immediately followed by "Hello world!"
```

## Type reference

```js
type RetryOptions<Result> = {|
    retryCondition: RetryCondition<Result>,
    /**
     * The strategy to use. Can provide an instance of LinearRetryStrategy or ExponentialBackoffRetryStrategy, or a custom strategy conforming to the type `RetryStrategy`.
     */
    retryStrategy?: RetryStrategy,
    /**
     * Whether or not retries should be staggered slightly, to, for example, avoid possible DoSing of services. Will stagger somewhere between 0 and 10% of the current retry delay
     */
    staggerRetries?: boolean,
    immediatelyRetry?: boolean,
|};

type RetryCondition<Result> = (Result) => (boolean | Promise<boolean>);

type RetryStrategy = { +resolveNextWaitTime: (previousWaitTimeMs: number) => number }
```