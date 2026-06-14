import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

// ---------------- Types ----------------
export interface ConceptNodeOut {
  id: string
  node_key: string
  title: string
  description?: string
  prerequisites: string[]
  sequential_position: number
  difficulty: number
  chapter_reference?: string
  simulation_type?: string
  status: string
  mastery_score: number
  key_skills: string[]
  estimated_minutes?: number
  content_md?: string
}

export interface RoadmapResponse {
  learning_path_id: string
  session_id: string
  title: string
  nodes: ConceptNodeOut[]
  edges: { source: string; target: string }[]
  sequential_order: string[]
  current_step: number
  mind_map: { nodes: any[]; links: any[] }
  simulations: any[]
  agent_logs: AgentLog[]
}

export interface AgentLog {
  agent_name: string
  action: string
  input_summary?: string
  output_summary?: string
  status: string
  duration_ms?: number
  created_at: string
}

export interface CourseSummary {
  learning_path_id: string
  title: string
  source_type: string
  progress_percent: number
  total_nodes: number
  mastered_nodes: number
  current_node_title?: string
  difficulty_level: string
  created_at: string
}

export interface DailyProgressOut {
  date: string
  concepts_studied: number
  quizzes_taken: number
  quizzes_passed: number
  total_time_sec: number
  avg_score: number
  xp_earned: number
}

export interface ProctoringProfileOut {
  avg_reading_speed?: number
  avg_quiz_time?: number
  correct_rate: number
  strength_tags: string[]
  weakness_tags: string[]
  preferred_difficulty: string
  consistency_score: number
  total_study_time_sec: number
  roadmap_adjustments: number
  insight?: string
}

export interface DashboardResponse {
  user_id: string
  full_name: string
  courses: CourseSummary[]
  daily_progress: DailyProgressOut[]
  weekly_summary: Record<string, any>
  proctoring: ProctoringProfileOut
  total_xp: number
  streak_days: number
}

// ---------------- Auth ----------------
export async function signup(email: string, password: string, fullName: string) {
  const { data } = await api.post('/auth/signup', { email, password, full_name: fullName })
  return data
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const { data } = await api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

// ---------------- Intake ----------------
export async function submitTopic(topic: string) {
  const { data } = await api.post('/topic', { topic })
  return data
}

export async function uploadDocument(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ---------------- Roadmap ----------------
export async function generateRoadmap(params: {
  mode: 'topic' | 'book'
  topic?: string
  document_id?: string
}) {
  const { data } = await api.post<RoadmapResponse>('/generate-roadmap', params)
  return data
}

export async function getLearningPath(learningPathId: string) {
  const { data } = await api.get<RoadmapResponse>(`/learning-paths/${learningPathId}`)
  return data
}

// ---------------- Simulation ----------------
export async function generateSimulation(conceptNodeId: string) {
  const { data } = await api.post('/generate-simulation', { concept_node_id: conceptNodeId })
  return data
}

export async function recordSimulationViewed(conceptNodeId: string, timeSpentSec: number) {
  const { data } = await api.post('/simulation-viewed', {
    concept_node_id: conceptNodeId, time_spent_sec: timeSpentSec,
  })
  return data
}

export async function recordContentViewed(conceptNodeId: string, timeSpentSec: number) {
  const { data } = await api.post('/content-viewed', {
    concept_node_id: conceptNodeId, time_spent_sec: timeSpentSec,
  })
  return data
}

// ---------------- Quiz ----------------
export async function generateQuiz(conceptNodeId: string) {
  const { data } = await api.post('/generate-quiz', { concept_node_id: conceptNodeId })
  return data
}

export async function evaluateQuiz(
  quizAttemptId: string,
  answers: Record<string, number>,
  timeTakenSec: number,
  perQuestionTime: Record<string, number>
) {
  const { data } = await api.post('/evaluate', {
    quiz_attempt_id: quizAttemptId, answers,
    time_taken_sec: timeTakenSec, per_question_time: perQuestionTime,
  })
  return data
}

// ---------------- Mind map / agent log ----------------
export async function getMindMap(learningPathId: string) {
  const { data } = await api.get('/mindmap', { params: { learning_path_id: learningPathId } })
  return data
}

export async function getAgentLog(sessionId: string) {
  const { data } = await api.get('/agent-log', { params: { session_id: sessionId } })
  return data
}

// ---------------- Dashboard ----------------
export async function getDashboard() {
  const { data } = await api.get<DashboardResponse>('/dashboard')
  return data
}
