import { describe, expect, it } from "vitest";
import { prepareOutputFiles } from "../src/generator";

describe("generator.generateConfig", () => {
	it("generates extends with repo path and presets", () => {
		const files = prepareOutputFiles(".", [], {
			languages: ["nodejs"],
			packageManagers: [],
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

	it("includes tool presets in extends", () => {
		const files = prepareOutputFiles(".", [], {
			languages: [],
			packageManagers: [],
			tools: ["lefthook"],
			options: [],
		});
		const root = files.find((f) => f.isRoot);
		if (!root) throw new Error("Root file not found");
		const config = JSON.parse(root.content);

		// biome-ignore lint/suspicious/noExplicitAny: test config object
		expect((config as any).extends).toContain(
			"github>scottlz0310/renovate-config//presets/tools/lefthook",
		);
	});

	it.each(["npm", "pnpm", "bun"])(
		"includes the %s package-manager preset in extends",
		(packageManager) => {
			const files = prepareOutputFiles(".", [], {
				languages: [],
				packageManagers: [packageManager],
				tools: [],
				options: [],
			});
			const root = files.find((file) => file.isRoot);
			if (!root) throw new Error("Root file not found");
			const config = JSON.parse(root.content) as { extends: string[] };

			expect(config.extends).toContain(
				`github>scottlz0310/renovate-config//presets/package-managers/${packageManager}`,
			);
		},
	);
});
