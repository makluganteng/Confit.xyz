module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@confit/shared/(.*)$": "<rootDir>/packages/shared/$1",
    "^@confit/pacifica-sdk/(.*)$": "<rootDir>/packages/pacifica-sdk/$1",
    "^@/(.*)$": "<rootDir>/apps/web/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { esModuleInterop: true } }],
  },
};
