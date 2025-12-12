import { describe, expect, it } from "vitest";
import { prepareOutputFiles } from "../src/generator";

describe("generator.generateConfig", () => {
	it("generates extends with repo path and presets", () => {
		const files = prepareOutputFiles(".", [], {
			languages: ["nodejs"],
			tools: [],
			options: ["automerge"],
		});
		const root = files.find((f) => f.isRoot);
		if (!root) throw new Error("Root file not found");
		const config = JSON.parse(root.content);

		// biome-ignore lint/suspicious/noExplicitAny: test config object
		expect((config as any).extends).toContain(
			"github>scottlz0310/renovate-config//presets/default",
		);
		// biome-ignore lint/suspicious/noExplicitAny: test config object
		expect((config as any).extends).toContain(
			"github>scottlz0310/renovate-config//presets/languages/nodejs",
		);
		// biome-ignore lint/suspicious/noExplicitAny: test config object
		expect((config as any).extends).toContain(
			"github>scottlz0310/renovate-config//presets/options/automerge",
		);
	});
});
