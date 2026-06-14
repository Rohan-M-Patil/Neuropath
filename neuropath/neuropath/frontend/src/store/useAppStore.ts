import { create } from 'zustand'
import { RoadmapResponse, ConceptNodeOut } from '../lib/api'

interface AppState {
  roadmap: RoadmapResponse | null
  selectedNode: ConceptNodeOut | null
  setRoadmap: (r: RoadmapResponse) => void
  setSelectedNode: (n: ConceptNodeOut | null) => void
  updateNodeStatus: (nodeKey: string, status: string, masteryScore?: number) => void
  unlockNodes: (nodeKeys: string[], currentStep?: number) => void
  clearRoadmap: () => void
}

export const useAppStore = create<AppState>((set) => ({
  roadmap: null,
  selectedNode: null,
  setRoadmap: (r) => set({ roadmap: r, selectedNode: null }),
  setSelectedNode: (n) => set({ selectedNode: n }),
  updateNodeStatus: (nodeKey, status, masteryScore) =>
    set((state) => {
      if (!state.roadmap) return state
      return {
        roadmap: {
          ...state.roadmap,
          nodes: state.roadmap.nodes.map((n) =>
            n.node_key === nodeKey
              ? { ...n, status, mastery_score: masteryScore ?? n.mastery_score }
              : n
          ),
        },
        selectedNode: state.selectedNode && state.selectedNode.node_key === nodeKey
          ? { ...state.selectedNode, status, mastery_score: masteryScore ?? state.selectedNode.mastery_score }
          : state.selectedNode,
      }
    }),
  unlockNodes: (nodeKeys, currentStep) =>
    set((state) => {
      if (!state.roadmap) return state
      return {
        roadmap: {
          ...state.roadmap,
          current_step: currentStep ?? state.roadmap.current_step,
          nodes: state.roadmap.nodes.map((n) =>
            nodeKeys.includes(n.node_key) && n.status === 'locked'
              ? { ...n, status: 'available' }
              : n
          ),
        },
      }
    }),
  clearRoadmap: () => set({ roadmap: null, selectedNode: null }),
}))
