import { defineConfig } from "oxfmt"

export default defineConfig({
	semi: false,
	singleQuote: false,
	useTabs: true,
	sortImports: {
		ignoreCase: true,
		newlinesBetween: true,
		order: "asc",
	},
})
