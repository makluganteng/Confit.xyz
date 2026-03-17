module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@confit/shared/(.*)$": "<rootDir>/packages/shared/$1",
  },
};
