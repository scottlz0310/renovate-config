type PresetCategory = "languages" | "package-managers" | "tools";
interface DetectionRule {
    preset: string;
    category: PresetCategory;
    label: string;
    patterns: string[];
}
interface DetectionResult {
    preset: string;
    category: PresetCategory;
    label: string;
    matchedFiles: string[];
}
interface PackageLocation {
    path: string;
    relativePath: string;
    detectedPresets: DetectionResult[];
}
export interface ScanResult {
    root: PackageLocation;
    packages: PackageLocation[];
    isMonorepo: boolean;
}
declare const DETECTION_RULES: DetectionRule[];
export declare const OPTION_PRESETS: {
    preset: string;
    label: string;
    description: string;
}[];
export declare function scanProject(cwd: string): Promise<ScanResult>;
export declare function getAllDetectedPresets(scanResult: ScanResult): Set<string>;
export { DETECTION_RULES };
//# sourceMappingURL=detector.d.ts.map