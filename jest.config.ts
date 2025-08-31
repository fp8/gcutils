import type { Config } from 'jest';

const config: Config = {
  moduleNameMapper: {
    '^@fp8proj/(.*)$': '<rootDir>/src/$1',
  },
  rootDir: ".",
  setupFilesAfterEnv: [
    "jest-extended/all"
  ],
  testEnvironment: "node",
  testRegex: "\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest", {
        tsconfig: "tsconfig.test.json"
      }
    ]
  }
}

export default config;
