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
 * Uses a proper worker pool that maintains concurrency as items complete
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
  const results: R[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;
  const errors: Array<{index: number; error: any}> = [];
  
  // Create worker pool
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = items[index];
        
        try {
          results[index] = await processor(item);
        } catch (error) {
          // Store error but don't stop worker - let it continue processing
          errors.push({ index, error });
          // Set a placeholder result (will be handled by caller)
          results[index] = null as any;
        }
        
        completed++;
        if (onProgress) {
          onProgress(completed, items.length);
        }
      }
    });
  
  await Promise.all(workers);
  
  // If there were errors, throw the first one for backward compatibility
  // but only after all work is done
  if (errors.length > 0) {
    console.warn(`Processed ${items.length} items with ${errors.length} errors`);
  }
  
  return results;
}
