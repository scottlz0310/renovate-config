/**
 * Interactive prompts using @clack/prompts
 */
import * as p from "@clack/prompts";
import type { ScanResult } from "./detector.js";
import type { OutputFile } from "./generator.js";
interface SelectedPresets {
    languages: string[];
    packageManagers: string[];
    tools: string[];
    options: string[];
}
export declare function displayScanResult(scanResult: ScanResult): void;
export declare function selectPresets(scanResult: ScanResult): Promise<SelectedPresets | typeof p.CANCEL_SYMBOL>;
export declare function confirmOutputLocations(files: OutputFile[]): Promise<boolean | typeof p.CANCEL_SYMBOL>;
export declare function displayResults(files: OutputFile[]): void;
export {};
//# sourceMappingURL=prompts.d.ts.map