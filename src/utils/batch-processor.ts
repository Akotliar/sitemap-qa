/**
 * Batch Processing Utilities
 * Provides array chunking and concurrent batch processing for performance optimization
 */

/**
 * Split array into chunks of specified size
 * @param array - Array to split into chunks
 * @param chunkSize - Size of each chunk
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Process items in batches with controlled concurrency
 * @param items - Array of items to process
 * @param concurrency - Maximum number of concurrent operations
 * @param processor - Async function to process each item
 * @param onProgress - Optional progress callback (completed, total)
 * @returns Array of results from processing all items
 */
export async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    completed += batch.length;
    if (onProgress) {
      onProgress(completed, items.length);
    }
  }
  
  return results;
}
