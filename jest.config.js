/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  maxWorkers: 1,
  testTimeout: 90_000,
  setupFiles: ["<rootDir>/jest.setup.js"],
  // uuid@9+ adalah ESM-only — Jest's CJS runtime tidak bisa require() langsung.
  moduleNameMapper: {
    "^uuid$": "<rootDir>/src/test/__mocks__/uuid.js",
  },
};
