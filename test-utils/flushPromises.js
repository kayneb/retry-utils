// @flow

export default async function flushPromises() {
    return new Promise((resolve) => {
        setImmediate(resolve);
    });
}
