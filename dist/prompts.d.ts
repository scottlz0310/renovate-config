import type { ScanResult } from "./detector.js";
import type { OutputFile } from "./generator.js";
interface SelectedPresets {
    languages: string[];
    tools: string[];
    options: string[];
}
export declare function displayScanResult(scanResult: ScanResult): void;
export declare function selectPresets(scanResult: ScanResult): Promise<SelectedPresets | symbol>;
export declare function confirmOutputLocations(files: OutputFile[]): Promise<boolean | symbol>;
export declare function displayResults(files: OutputFile[]): void;
export {};
//# sourceMappingURL=prompts.d.ts.map