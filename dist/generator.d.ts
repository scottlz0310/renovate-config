export interface GenerateOptions {
    languages: string[];
    tools: string[];
    options: string[];
}
export interface OutputFile {
    path: string;
    relativePath: string;
    content: string;
    isRoot: boolean;
}
export declare function prepareOutputFiles(rootPath: string, packagePaths: string[], options: GenerateOptions): OutputFile[];
export declare function writeOutputFiles(files: OutputFile[]): Promise<void>;
//# sourceMappingURL=generator.d.ts.map