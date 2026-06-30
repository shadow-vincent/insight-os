'use client';

/**
 * V1.10 IndexedDB React Hooks
 *
 * 每个 hook 返回 { data, loading, error, refetch }
 * 自动 useEffect + state 管理 + refetch on filter change
 *
 * 调用方：
 *   const { data: candidates, loading } = useAssets({ status: ['candidate', 'sorting', 'inbox'] });
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getAssets, getAsset, getTopics, getTopic, getAssetTopicsByAsset,
  getSources, getSource, getSourceItems, getNewSourceItems,
  getFeedbackForAsset, getAllFeedback, getOutputs, getOutputsByAsset,
  getTopicKernel, getAllTopicKernels, getUserKernels, getActiveUserKernels,
  getWritingDraft, getWritingVersions, getStats,
} from './operations';
import type {
  AssetRow, TopicRow, AssetTopicRow, SourceRow, SourceItemRow,
  FeedbackRow, OutputRow, TopicKernelRow, UserKernelRow,
} from './db';

interface UseResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useAsyncQuery<T>(query: () => Promise<T>, deps: any[]): UseResult<T> {
  const [data, setData] = useState<T>(null as any);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await query();
      setData(result);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useAssets(filter?: Parameters<typeof getAssets>[0]): UseResult<AssetRow[]> {
  return useAsyncQuery<AssetRow[]>(() => getAssets(filter), [JSON.stringify(filter)]);
}

export function useAsset(id: string | null | undefined): UseResult<AssetRow | undefined> {
  return useAsyncQuery<AssetRow | undefined>(() => id ? getAsset(id) : Promise.resolve(undefined), [id]);
}

export function useTopics(): UseResult<TopicRow[]> {
  return useAsyncQuery<TopicRow[]>(() => getTopics(), []);
}

export function useTopic(id: string | null | undefined): UseResult<TopicRow | undefined> {
  return useAsyncQuery<TopicRow | undefined>(() => id ? getTopic(id) : Promise.resolve(undefined), [id]);
}

export function useAssetTopicsByAsset(assetId: string | null | undefined): UseResult<AssetTopicRow[]> {
  return useAsyncQuery<AssetTopicRow[]>(() => assetId ? getAssetTopicsByAsset(assetId) : Promise.resolve([]), [assetId]);
}

export function useSources(): UseResult<SourceRow[]> {
  return useAsyncQuery<SourceRow[]>(() => getSources(), []);
}

export function useSource(id: string | null | undefined): UseResult<SourceRow | undefined> {
  return useAsyncQuery<SourceRow | undefined>(() => id ? getSource(id) : Promise.resolve(undefined), [id]);
}

export function useSourceItems(sourceId: string | null | undefined): UseResult<SourceItemRow[]> {
  return useAsyncQuery<SourceItemRow[]>(() => sourceId ? getSourceItems(sourceId) : Promise.resolve([]), [sourceId]);
}

export function useNewSourceItems(): UseResult<SourceItemRow[]> {
  return useAsyncQuery<SourceItemRow[]>(() => getNewSourceItems(), []);
}

export function useFeedbackForAsset(assetId: string | null | undefined): UseResult<FeedbackRow[]> {
  return useAsyncQuery<FeedbackRow[]>(() => assetId ? getFeedbackForAsset(assetId) : Promise.resolve([]), [assetId]);
}

export function useAllFeedback(): UseResult<FeedbackRow[]> {
  return useAsyncQuery<FeedbackRow[]>(() => getAllFeedback(), []);
}

export function useOutputs(limit?: number): UseResult<OutputRow[]> {
  return useAsyncQuery<OutputRow[]>(() => getOutputs(limit), [limit]);
}

export function useOutputsByAsset(assetId: string | null | undefined): UseResult<OutputRow[]> {
  return useAsyncQuery<OutputRow[]>(() => assetId ? getOutputsByAsset(assetId) : Promise.resolve([]), [assetId]);
}

export function useTopicKernel(topicId: string | null | undefined): UseResult<TopicKernelRow | undefined> {
  return useAsyncQuery<TopicKernelRow | undefined>(() => topicId ? getTopicKernel(topicId) : Promise.resolve(undefined), [topicId]);
}

export function useAllTopicKernels(): UseResult<TopicKernelRow[]> {
  return useAsyncQuery<TopicKernelRow[]>(() => getAllTopicKernels(), []);
}

export function useUserKernels(): UseResult<UserKernelRow[]> {
  return useAsyncQuery<UserKernelRow[]>(() => getUserKernels(), []);
}

export function useActiveUserKernels(): UseResult<UserKernelRow[]> {
  return useAsyncQuery<UserKernelRow[]>(() => getActiveUserKernels(), []);
}

export function useWritingDraft(writingId: string | null | undefined): UseResult<any> {
  return useAsyncQuery<any>(() => writingId ? getWritingDraft(writingId) : Promise.resolve(undefined), [writingId]);
}

export function useWritingVersions(writingId: string | null | undefined): UseResult<any[]> {
  return useAsyncQuery<any[]>(() => writingId ? getWritingVersions(writingId) : Promise.resolve([]), [writingId]);
}

export function useStats(): UseResult<Awaited<ReturnType<typeof getStats>>> {
  return useAsyncQuery<Awaited<ReturnType<typeof getStats>>>(() => getStats(), []);
}