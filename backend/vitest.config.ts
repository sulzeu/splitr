module.exports = {
  test: {
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["test/**", "src/**/*.d.ts"],
      thresholds: {
        statements: 78,
        branches: 68,
        functions: 76,
        lines: 80,
      },
    },
  },
};
