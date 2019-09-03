// Allows for testing interaction with fetch
global.fetch = require("jest-fetch-mock");
global.fetchMock = global.fetch;
