/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  maxWorkers: 1,
  testTimeout: 90_000,
  setupFiles: ["<rootDir>/jest.setup.js"],
};
