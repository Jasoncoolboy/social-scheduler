import { create } from "zustand"

export const usePostStore = create((set) => ({
  selectedPost: null,
  setSelectedPost: (post) => set({ selectedPost: post }),
  clearSelectedPost: () => set({ selectedPost: null }),
}))