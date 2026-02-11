import { create } from "zustand";
import type { DiffSegment } from "@/lib/diff";

export interface OverlayState {
  visible: boolean;
  loading: boolean;
  error: string | null;
  originalText: string;
  improvedText: string;
  segments: DiffSegment[];
  style: string;

  // Actions
  show: (originalText: string) => void;
  hide: () => void;
  setImprovedText: (text: string) => void;
  setSegments: (segments: DiffSegment[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStyle: (style: string) => void;
  accept: () => void;
  dismiss: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  visible: false,
  loading: false,
  error: null,
  originalText: "",
  improvedText: "",
  segments: [],
  style: "casual",

  show: (originalText: string) =>
    set({
      visible: true,
      loading: true,
      error: null,
      originalText,
      improvedText: "",
      segments: [],
    }),

  hide: () =>
    set({
      visible: false,
      loading: false,
      error: null,
      originalText: "",
      improvedText: "",
      segments: [],
    }),

  setImprovedText: (text: string) => set({ improvedText: text }),

  setSegments: (segments: DiffSegment[]) =>
    set({ segments, loading: false }),

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) =>
    set({ error, loading: false }),

  setStyle: (style: string) => set({ style }),

  accept: () =>
    set({
      visible: false,
      loading: false,
      error: null,
    }),

  dismiss: () =>
    set({
      visible: false,
      loading: false,
      error: null,
    }),
}));
