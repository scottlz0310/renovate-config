import { describe, expect, it, type Mock, vi } from "vitest";

// We'll mock @clack/prompts to capture calls
vi.mock("@clack/prompts", () => ({
	multiselect: vi.fn(),
	select: vi.fn(),
	confirm: vi.fn(),
	isCancel: (_v: unknown) => false,
	log: { info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

import * as p from "@clack/prompts";
import type { ScanResult } from "../src/detector.js";
import { selectPresets } from "../src/prompts";

describe("prompts.selectPresets", () => {
	it("selects languages, then tools, then options", async () => {
		const multiselect = p.multiselect as unknown as Mock;

		type PromptOption = { value: string; hint?: string };
		let languageOptions: PromptOption[] | undefined;
		let toolOptions: PromptOption[] | undefined;

		multiselect
			.mockImplementationOnce(async (args: { options: PromptOption[] }) => {
				languageOptions = args.options;
				return ["nodejs"];
			})
			.mockImplementationOnce(async (args: { options: PromptOption[] }) => {
				toolOptions = args.options;
				return ["precommit", "lefthook"];
			})
			.mockImplementationOnce(async () => ["automerge"]);

		const mockScanResult: ScanResult = {
			root: {
				path: ".",
				relativePath: ".",
				detectedPresets: [
					{
						preset: "nodejs",
						category: "languages",
						label: "Node.js",
						matchedFiles: ["package.json"],
					},
					{
						preset: "precommit",
						category: "tools",
						label: "Pre-commit",
						matchedFiles: [".pre-commit-config.yaml"],
					},
					{
						preset: "lefthook",
						category: "tools",
						label: "Lefthook",
						matchedFiles: [".lefthook.yml"],
					},
				],
			},
			packages: [],
			isMonorepo: false,
		};

		const result = await selectPresets(mockScanResult);

		expect(result).toEqual({
			languages: ["nodejs"],
			tools: ["precommit", "lefthook"],
			options: ["automerge"],
		});

		expect(Array.isArray(languageOptions)).toBe(true);
		const nodeOption = languageOptions?.find((o) => o.value === "nodejs");
		expect(nodeOption).toBeTruthy();
		expect(nodeOption.hint).toBe("recommended");

		expect(Array.isArray(toolOptions)).toBe(true);
		const lefthookOption = toolOptions?.find((o) => o.value === "lefthook");
		expect(lefthookOption).toBeTruthy();
		expect(lefthookOption.hint).toBe("recommended");
	});
});
