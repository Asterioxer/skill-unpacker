export interface SecurityLimits {
  maxEntries?: number;
  maxTotalBytes?: number;
  maxSingleFileBytes?: number;
  maxCompressionRatio?: number;
  allowOverwrite?: boolean;
  rejectSymlinks?: boolean;
  rejectWindowsReserved?: boolean;
}

export interface ArchiveEntry {
  name: string;
  directory: boolean;
  compressedSize: number;
  uncompressedSize: number;
  crc32?: number;
}

export interface InspectionResult {
  archivePath: string;
  archiveName: string;
  archiveBytes: number;
  entryCount: number;
  totalUncompressedBytes: number;
  roots: string[];
  hasSkillMd: boolean;
  skillFiles: string[];
  duplicateEntries: string[];
  entries: ArchiveEntry[];
}

export interface ExtractOptions {
  limits?: SecurityLimits;
  overwrite?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: {
    entry: string;
    entryIndex: number;
    totalEntries: number;
    extractedBytes: number;
    totalBytes: number;
    percent: number;
  }) => void;
}

export interface ExtractionResult {
  destination: string;
  extractedFiles: number;
  extractedBytes: number;
}

export interface SkillMdInfo {
  name: string | null;
  description: string | null;
  version: string | null;
  lines: number;
  rawFrontmatter: string;
  attributes: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  folderPath: string;
  skillPath: string | null;
  errors: string[];
  warnings: string[];
  files: string[];
  skillMd: SkillMdInfo | null;
}

export interface PackOptions {
  skipValidation?: boolean;
  rootPrefix?: string | boolean;
  signal?: AbortSignal;
  onProgress?: (progress: {
    file: string;
    index: number;
    total: number;
    percent: number;
  }) => void;
}

export interface PackResult {
  outputPath: string;
  filesPacked: number;
  totalBytes: number;
}

export class SkillUnpackerError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(message: string, code?: string, details?: Record<string, unknown>);
}

export class PathTraversalError extends SkillUnpackerError {}
export class UnsafePathError extends SkillUnpackerError {}
export class SymlinkError extends SkillUnpackerError {}
export class OversizedArchiveError extends SkillUnpackerError {}
export class OversizedFileError extends SkillUnpackerError {}
export class TooManyEntriesError extends SkillUnpackerError {}
export class CompressionRatioError extends SkillUnpackerError {}
export class FileExistsError extends SkillUnpackerError {}
export class DuplicateEntryError extends SkillUnpackerError {}
export class ValidationError extends SkillUnpackerError {
  errors: string[];
  warnings: string[];
}
export class InvalidArchiveError extends SkillUnpackerError {}
export class AbortError extends SkillUnpackerError {}

export const DEFAULT_LIMITS: Readonly<Required<SecurityLimits>>;

export function inspectArchive(
  archivePath: string,
  options?: { limits?: SecurityLimits; allowDuplicateEntries?: boolean }
): Promise<InspectionResult>;

export function extractArchive(
  archivePath: string,
  destination: string,
  options?: ExtractOptions
): Promise<ExtractionResult>;

export function validateSkill(folderPath: string): Promise<ValidationResult>;

export function packSkill(
  folderPath: string,
  outputPath: string,
  options?: PackOptions
): Promise<PackResult>;

export function parseFrontmatter(
  content: string
): { frontmatter: Record<string, any>; rawFrontmatter: string; body: string } | null;

export function sanitizeEntryName(
  rawName: string,
  options?: { rejectWindowsReserved?: boolean }
): string;

export function isSymlink(entry: any): boolean;
export function isPathInside(destinationRoot: string, targetPath: string): boolean;
export function walkFiles(root: string, current?: string, output?: string[]): Promise<string[]>;
export function openZip(filePath: string): Promise<any>;
