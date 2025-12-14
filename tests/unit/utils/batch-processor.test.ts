import { describe, it, expect } from 'vitest';
import { chunkArray, processInBatches } from '@/utils/batch-processor';

describe('Batch Processor Utilities', () => {
  describe('chunkArray', () => {
    it('should split array into correct chunks', () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const chunks = chunkArray(items, 10);
      
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(chunks[1]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
      expect(chunks[2]).toEqual([20, 21, 22, 23, 24]);
    });

    it('should handle exact division', () => {
      const items = Array.from({ length: 20 }, (_, i) => i);
      const chunks = chunkArray(items, 10);
      
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(10);
      expect(chunks[1].length).toBe(10);
    });

    it('should handle empty array', () => {
      const chunks = chunkArray([], 10);
      expect(chunks).toEqual([]);
    });

    it('should handle array smaller than chunk size', () => {
      const items = [1, 2, 3];
      const chunks = chunkArray(items, 10);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual([1, 2, 3]);
    });

    it('should handle chunk size of 1', () => {
      const items = [1, 2, 3];
      const chunks = chunkArray(items, 1);
      
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toEqual([1]);
      expect(chunks[1]).toEqual([2]);
      expect(chunks[2]).toEqual([3]);
    });

    it('should handle large arrays', () => {
      const items = Array.from({ length: 25000 }, (_, i) => i);
      const chunks = chunkArray(items, 10000);
      
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(10000);
      expect(chunks[1].length).toBe(10000);
      expect(chunks[2].length).toBe(5000);
    });
  });

  describe('processInBatches', () => {
    it('should process all items', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const results = await processInBatches(
        items,
        3,
        async (item) => item * 2
      );
      
      expect(results.length).toBe(10);
      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    });

    it('should process batches with concurrency limit', async () => {
      const items = Array.from({ length: 20 }, (_, i) => i);
      const processingOrder: number[] = [];
      
      await processInBatches(
        items,
        5, // 5 concurrent
        async (item) => {
          processingOrder.push(item);
          await new Promise(resolve => setTimeout(resolve, 10));
          return item * 2;
        }
      );
      
      // First 5 items should be processed concurrently
      expect(processingOrder.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
      // Then next 5, etc.
      expect(processingOrder.slice(5, 10)).toEqual([5, 6, 7, 8, 9]);
    });

    it('should call progress callback correctly', async () => {
      const items = Array.from({ length: 30 }, (_, i) => i);
      const progressUpdates: Array<{completed: number, total: number}> = [];
      
      await processInBatches(
        items,
        10,
        async (item) => item,
        (completed, total) => {
          progressUpdates.push({ completed, total });
        }
      );
      
      expect(progressUpdates.length).toBe(3); // 3 batches
      expect(progressUpdates[0]).toEqual({ completed: 10, total: 30 });
      expect(progressUpdates[1]).toEqual({ completed: 20, total: 30 });
      expect(progressUpdates[2]).toEqual({ completed: 30, total: 30 });
    });

    it('should handle empty array', async () => {
      const results = await processInBatches(
        [],
        5,
        async (item) => item
      );
      
      expect(results).toEqual([]);
    });

    it('should handle single item', async () => {
      const results = await processInBatches(
        [42],
        5,
        async (item) => item * 2
      );
      
      expect(results).toEqual([84]);
    });

    it('should propagate errors from processor', async () => {
      const items = [1, 2, 3];
      
      await expect(
        processInBatches(
          items,
          2,
          async (item) => {
            if (item === 2) throw new Error('Processing failed');
            return item;
          }
        )
      ).rejects.toThrow('Processing failed');
    });

    it('should maintain result order', async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const results = await processInBatches(
        items,
        10,
        async (item) => {
          // Random delay to simulate real async work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return item * 2;
        }
      );
      
      // Results should be in order despite async processing
      expect(results).toEqual(items.map(i => i * 2));
    });

    it('should complete processing even if progress callback throws', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      
      // Progress callback throwing will cause the function to throw
      await expect(
        processInBatches(
          items,
          5,
          async (item) => item * 2,
          () => {
            throw new Error('Progress callback error');
          }
        )
      ).rejects.toThrow('Progress callback error');
    });
  });
});
