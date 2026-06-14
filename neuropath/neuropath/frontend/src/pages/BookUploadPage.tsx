import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { uploadDocument, generateRoadmap } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

export default function BookUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'generating'>('idle')
  const [chapters, setChapters] = useState<{ title: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setRoadmap } = useAppStore()

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  async function handleUploadAndGenerate() {
    if (!file) return
    setError(null)
    setStage('uploading')
    try {
      const uploadRes = await uploadDocument(file)
      setChapters(uploadRes.chapters)

      setStage('generating')
      const roadmap = await generateRoadmap({
        mode: 'book',
        document_id: uploadRes.document_id,
      })
      setRoadmap(roadmap)
      navigate('/roadmap')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to process document.')
      setStage('idle')
    }
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-2xl mx-auto px-6 py-20">
        <p className="font-mono text-xs text-ember uppercase tracking-[0.2em] mb-3">
          Flow B — Book Intelligence Mode
        </p>
        <h1 className="font-display text-4xl font-semibold mb-3">Upload your textbook</h1>
        <p className="text-dim mb-8">
          PDF or DOCX. The system parses chapters, extracts concepts, and builds
          a chapter-grounded DAG with chapter references for every concept.
        </p>

        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="block border-2 border-dashed border-white/10 rounded-xl p-10 text-center cursor-pointer hover:border-ember/40 transition-colors"
        >
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <p className="font-medium text-myelin mb-1">{file.name}</p>
              <p className="text-xs text-dim">{(file.size / 1024).toFixed(1)} KB · click to change</p>
            </div>
          ) : (
            <div>
              <p className="text-myelin mb-1">Drop a PDF or DOCX, or click to browse</p>
              <p className="text-xs text-dim">Max recommended size: 20MB</p>
            </div>
          )}
        </label>

        {chapters.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-dim mb-2 font-mono uppercase tracking-wide">
              Detected chapters ({chapters.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {chapters.slice(0, 8).map((c, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-dim">
                  {c.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-ember mt-4">{error}</p>}

        <button
          onClick={handleUploadAndGenerate}
          disabled={!file || stage !== 'idle'}
          className="w-full mt-8 px-6 py-3.5 rounded-lg bg-ember text-void font-medium shadow-emberGlow hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {stage === 'uploading' && (
            <>
              <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              Parsing document…
            </>
          )}
          {stage === 'generating' && (
            <>
              <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              Agents are building your roadmap…
            </>
          )}
          {stage === 'idle' && 'Process document & generate roadmap'}
        </button>
      </main>
    </div>
  )
}
