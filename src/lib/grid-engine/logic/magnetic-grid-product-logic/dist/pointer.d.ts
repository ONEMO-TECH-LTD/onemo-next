export declare function candidatePointer(index: number): string;
export declare function parseCandidatePointer(value: unknown, path: string): number;
export declare function parseSizePointer(value: unknown, path: string): number;
export declare function parsePositionPointer(value: unknown, path: string): {
    readonly sizeIndex: number;
    readonly positionIndex: number;
};
