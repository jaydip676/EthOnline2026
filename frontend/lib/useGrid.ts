"use client";

import { useReadContract } from "wagmi";
import { GRID_MANAGER, LENS, isDeployed } from "./addresses";
import { gridManagerAbi, lensAbi } from "./abi";

export function useGridCount(maker?: `0x${string}`) {
  return useReadContract({
    address: GRID_MANAGER,
    abi: gridManagerAbi,
    functionName: "gridCount",
    args: maker ? [maker] : undefined,
    query: { enabled: Boolean(maker) && isDeployed() },
  });
}

export function useGridView(maker?: `0x${string}`, gridId = 0n) {
  return useReadContract({
    address: LENS,
    abi: lensAbi,
    functionName: "gridView",
    args: maker ? [maker, gridId] : undefined,
    query: { enabled: Boolean(maker) && isDeployed() },
  });
}

export function useRungs(maker?: `0x${string}`, gridId = 0n) {
  return useReadContract({
    address: LENS,
    abi: lensAbi,
    functionName: "rungs",
    args: maker ? [maker, gridId] : undefined,
    query: { enabled: Boolean(maker) && isDeployed() },
  });
}

export function useReliability(maker?: `0x${string}`) {
  return useReadContract({
    address: LENS,
    abi: lensAbi,
    functionName: "reliabilityBps",
    args: maker ? [maker] : undefined,
    query: { enabled: Boolean(maker) && isDeployed() },
  });
}

export const PAUSED = [
  "Live",
  "Paused — price outside envelope",
  "Paused — oracle stale",
  "Paused — insufficient balance",
  "Paused — coverage breach",
  "Paused — allowance revoked",
  "Off (docked)",
] as const;
