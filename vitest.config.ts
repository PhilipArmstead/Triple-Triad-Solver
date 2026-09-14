import { defaultExclude, defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		include: ["src/**/*.spec.ts"],
		exclude: defaultExclude,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [...defaultExclude, "src/**/*.spec.ts", "src/test-utils/**"],
			thresholds: {
				branches: 100,
				perFile: true,
				statements: 100,
			},
		},
	},
})
