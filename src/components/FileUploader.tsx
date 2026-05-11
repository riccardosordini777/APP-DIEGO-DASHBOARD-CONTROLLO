import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle } from 'lucide-react'
import { useFileParser } from '../hooks/useFileParser'
import { useDashboardStore } from '../store/useDashboardStore'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const MODULE_HINTS = ['SI014', 'NA013', 'NA302', 'NA108'] as const

export function FileUploader() {
  const { parsedModules } = useDashboardStore()
  const { parseFile } = useFileParser()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingFile, setLoadingFile] = useState('')
  const dragCounter = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => /\.(xlsx|xls)$/i.test(f.name))
      if (arr.length === 0) {
        console.warn('[FileUploader] No .xlsx/.xls files selected')
        return
      }
      for (const file of arr) {
        try {
          setIsLoading(true)
          setLoadingFile(file.name)
          await parseFile(file)
        } catch (err) {
          console.error('[FileUploader] Unexpected error:', err)
        } finally {
          setIsLoading(false)
          setLoadingFile('')
        }
      }
    },
    [parseFile],
  )

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="p-8 flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full gap-8"
    >
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 transition-all duration-300 ${
          isDragging
            ? 'border-electric bg-electric/5'
            : 'border-border-dim bg-card hover:border-[#3f3f46]'
        }`}
      >
        <div className="w-20 h-20 bg-secondary border border-border-dim rounded-2xl flex items-center justify-center mb-6 relative">
          {isLoading ? (
            <Loader2 size={32} className="text-electric animate-spin" />
          ) : (
            <UploadCloud size={32} className={isDragging ? 'text-electric' : 'text-zinc-400'} />
          )}
          {!isLoading && (
            <div className="absolute -bottom-2 -right-2 bg-border-dim rounded-full p-1 border border-card">
              <FileSpreadsheet size={16} className="text-accent-green" />
            </div>
          )}
        </div>

        <h2 className="text-2xl font-semibold text-white mb-2">
          {isLoading ? `Caricamento ${loadingFile}...` : 'Inizializza Control Tower'}
        </h2>
        <p className="text-zinc-300 text-center max-w-md mb-8">
          {isLoading
            ? 'Analisi intestazioni e mappatura dati in corso...'
            : 'Trascina i tracciati Excel (SI014, NA013, NA302, NA108) per attivare la dashboard.'}
        </p>

        {!isLoading && (
          <>
            <Button asChild size="lg" className="rounded-full shadow-lg shadow-electric/20">
              <label className="cursor-pointer">
                Seleziona File
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".xlsx,.xls"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </Button>
          </>
        )}

        {isLoading && (
          <div className="w-full max-w-xs mt-6 space-y-2">
            <style>{`
              @keyframes shimmer-slide {
                0% { transform: translateX(-200%); }
                100% { transform: translateX(500%); }
              }
              .loading-shimmer {
                animation: shimmer-slide 1.2s ease-in-out infinite;
              }
            `}</style>
            <div className="relative w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="absolute top-0 h-full w-1/3 rounded-full loading-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)',
                }}
              />
            </div>
            <p className="text-base text-center text-zinc-300 tracking-wide">
              Analisi colonne in corso…
            </p>
          </div>
        )}
      </div>

      {/* Stato moduli */}
      <div className="flex gap-3 flex-wrap justify-center">
        {MODULE_HINTS.map((mod) => {
          const key = mod.toLowerCase() as keyof typeof parsedModules
          const loaded = !!parsedModules[key]
          return (
            <Badge
              key={mod}
              variant={loaded ? 'outline' : 'secondary'}
              className={
                loaded
                  ? 'border-accent-green/30 bg-accent-green/10 text-accent-green gap-1.5 py-1.5 px-3 text-base'
                  : 'border-border-dim text-zinc-400 gap-1.5 py-1.5 px-3 text-base'
              }
            >
              {loaded ? <CheckCircle size={12} /> : <FileSpreadsheet size={12} />}
              {mod}
              {loaded && parsedModules[key] && (
                <span className="opacity-70">
                  ({parsedModules[key]!.rowCount.toLocaleString('it-IT')} righe)
                </span>
              )}
            </Badge>
          )
        })}
      </div>
    </motion.div>
  )
}
