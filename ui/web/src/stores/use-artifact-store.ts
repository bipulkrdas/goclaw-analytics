import { create } from "zustand";

export interface ArtifactData {
  title: string;
  code: string;
  template: string;
  dependencies: Record<string, string>;
}

interface ArtifactStore {
  artifact: ArtifactData | null;
  open: boolean;
  setArtifact: (data: ArtifactData) => void;
  openPanel: () => void;
  closePanel: () => void;
  clear: () => void;
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  artifact: null,
  open: false,
  setArtifact: (data) => set({ artifact: data, open: true }),
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  clear: () => set({ artifact: null, open: false }),
}));
