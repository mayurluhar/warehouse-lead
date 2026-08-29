import { RawDocument } from '@warehouse-lead/core';
export declare const BENCHMARK_SIGNALS: Omit<RawDocument, 'id' | 'contentHash' | 'fetchedAt'>[];
export declare function getSampleDocuments(): RawDocument[];
