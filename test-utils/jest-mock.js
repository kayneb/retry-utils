// @flow

export function coerceJestMock<F: Function>(mock: F): JestMockFnFromOriginalSignature<F> {
    if (jest.isMockFunction(mock)) {
        return ((mock: any): JestMockFnFromOriginalSignature<F>);
    }

    throw Error("Attempted to coerce a function that is not a jest mock");
}

type ExtractReturnType = <Args: $ReadOnlyArray<*>, V>((...args: Args) => V) => V;

// eslint-disable-next-line prettier/prettier
export type JestMockFnFromOriginalSignature<F> = JestMockFn<*, $Call<ExtractReturnType, F>>;
