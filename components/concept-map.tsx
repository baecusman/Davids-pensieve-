"use client"

import React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { optimizedDatabase } from "@/lib/database/optimized-database"
import { performanceMonitor } from "@/lib/performance-monitor"
import { ErrorBoundary } from "./error-boundary"

interface ConceptNode {
  id: string
  label: string
  type: string
  density: number
  articles: string[]
  description?: string
  source: "analyzed" | "mock"
  frequency?: number
}

interface ConceptEdge {
  id: string
  source: string
  target: string
  type: string
  weight: number
}

interface ConceptMapProps {
  abstractionLevel: number
  searchQuery: string
  onNodeSelect: (nodeId: string | null) => void
  selectedNodeId: string | null
  filters?: {
    types: string[]
    minFrequency: number
    source: "all" | "analyzed" | "historical"
  }
}

interface NodePosition {
  id: string
  x: number
  y: number
}

// Memoized canvas drawing component
const ConceptMapCanvas = React.memo(function ConceptMapCanvas({
  abstractionLevel,
  searchQuery,
  onNodeSelect,
  selectedNodeId,
  filters = { types: [], minFrequency: 1, source: "all" },
}: ConceptMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const [nodes, setNodes] = useState<ConceptNode[]>([])
  const [edges, setEdges] = useState<ConceptEdge[]>([])
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoized layout calculation
  const calculateLayout = useCallback((nodes: ConceptNode[], canvasWidth: number, canvasHeight: number) => {
    const positions = new Map<string, NodePosition>()

    if (nodes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
      return positions
    }

    const sortedNodes = [...nodes].sort((a, b) => (b.density || 0) - (a.density || 0))
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const maxRadius = Math.min(centerX, centerY) * 0.7

    if (sortedNodes.length === 1) {
      positions.set(sortedNodes[0].id, { id: sortedNodes[0].id, x: centerX, y: centerY })
    } else {
      // Use force-directed layout for better distribution
      sortedNodes.forEach((node, index) => {
        const angle = (index / sortedNodes.length) * 2 * Math.PI
        const radius = maxRadius * (0.3 + (index / sortedNodes.length) * 0.4)
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius

        positions.set(node.id, {
          id: node.id,
          x: Math.max(50, Math.min(canvasWidth - 50, x)),
          y: Math.max(50, Math.min(canvasHeight - 50, y)),
        })
      })
    }

    return positions
  }, [])

  // Debounced data loading with error handling
  const loadData = useCallback(async () => {
    const timer = performanceMonitor.startTimer("render")

    try {
      setIsLoading(true)
      setError(null)

      const data = await optimizedDatabase.getConceptMapData(abstractionLevel, searchQuery)

      if (!data) {
        throw new Error("No data returned from database")
      }

      let filteredNodes = data.nodes || []

      // Apply filters
      if (filters.types.length > 0) {
        filteredNodes = filteredNodes.filter((node) => filters.types.includes(node.type))
      }

      if (filters.minFrequency > 1) {
        filteredNodes = filteredNodes.filter((node) => (node.frequency || 1) >= filters.minFrequency)
      }

      if (filters.source !== "all") {
        filteredNodes = filteredNodes.filter((node) =>
          filters.source === "analyzed" ? node.source === "analyzed" : node.source !== "analyzed",
        )
      }

      const nodeIds = new Set(filteredNodes.map((node) => node.id))
      const filteredEdges = (data.edges || []).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

      setNodes(filteredNodes)
      setEdges(filteredEdges)

      // Calculate positions
      const canvas = canvasRef.current
      if (canvas && filteredNodes.length > 0) {
        const container = canvas.parentElement
        if (container) {
          canvas.width = container.clientWidth
          canvas.height = container.clientHeight
        }

        const positions = calculateLayout(filteredNodes, canvas.width, canvas.height)
        setNodePositions(positions)
      }
    } catch (error) {
      console.error("Error loading concept map data:", error)
      setError("Failed to load concept map data")
      performanceMonitor.recordError()
    } finally {
      setIsLoading(false)
      timer()
    }
  }, [abstractionLevel, searchQuery, filters, calculateLayout])

  // Debounced loading
  useEffect(() => {
    const timeoutId = setTimeout(loadData, 300)
    return () => clearTimeout(timeoutId)
  }, [loadData])

  // Optimized drawing function with RAF
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (isLoading) {
      ctx.fillStyle = "#9ca3af"
      ctx.font = "16px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("Loading concept map...", canvas.width / 2, canvas.height / 2)
      return
    }

    if (error) {
      ctx.fillStyle = "#ef4444"
      ctx.font = "16px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(error, canvas.width / 2, canvas.height / 2)
      return
    }

    if (nodes.length === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "16px system-ui, sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("No concepts found", canvas.width / 2, canvas.height / 2 - 20)
      ctx.font = "14px system-ui, sans-serif"
      ctx.fillStyle = "#9ca3af"
      ctx.fillText("Add and analyze some content first", canvas.width / 2, canvas.height / 2)
      return
    }

    // Draw edges first
    ctx.strokeStyle = "#e5e7eb"
    edges.forEach((edge) => {
      const sourcePos = nodePositions.get(edge.source)
      const targetPos = nodePositions.get(edge.target)

      if (sourcePos && targetPos) {
        ctx.lineWidth = Math.max(1, edge.weight * 3)
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        ctx.moveTo(sourcePos.x, sourcePos.y)
        ctx.lineTo(targetPos.x, targetPos.y)
        ctx.stroke()
      }
    })

    // Draw nodes
    nodes.forEach((node) => {
      const pos = nodePositions.get(node.id)
      if (!pos) return

      const radius = Math.max(8, Math.min(25, 8 + (node.density / 100) * 17))
      const isSelected = selectedNodeId === node.id
      const isHighlighted = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase())
      const isAnalyzed = node.source === "analyzed"

      // Node color
      let fillStyle: string
      if (isSelected) {
        fillStyle = "#000000"
      } else if (isAnalyzed) {
        const intensity = node.density / 100
        const blueValue = Math.floor(59 + (130 - 59) * intensity)
        fillStyle = `rgb(59, ${blueValue}, 246)`
      } else {
        const intensity = node.density / 100
        const grayValue = Math.floor(156 + (100 - 156) * intensity)
        fillStyle = `rgb(${grayValue}, ${grayValue + 20}, ${grayValue + 40})`
      }

      ctx.globalAlpha = 1
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = isSelected ? "#374151" : isHighlighted ? "#f59e0b" : "#9ca3af"
      ctx.lineWidth = isSelected ? 3 : isHighlighted ? 2 : isAnalyzed ? 2 : 1

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Draw highlight ring
      if (isHighlighted && !isSelected) {
        ctx.strokeStyle = "#f59e0b"
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius + 3, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Draw label
      if (radius > 12 || isSelected || isHighlighted) {
        ctx.fillStyle = isSelected ? "#ffffff" : "#374151"
        ctx.font = `${Math.max(10, radius * 0.6)}px system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        const textMetrics = ctx.measureText(node.label)
        const textWidth = textMetrics.width
        const textHeight = 12

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
        ctx.fillRect(pos.x - textWidth / 2 - 2, pos.y + radius + 10, textWidth + 4, textHeight + 4)

        ctx.fillStyle = "#374151"
        ctx.fillText(node.label, pos.x, pos.y + radius + 17)
      }
    })
  }, [nodes, edges, nodePositions, selectedNodeId, searchQuery, isLoading, error])

  // Use RAF for smooth rendering
  useEffect(() => {
    const animate = () => {
      draw()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [draw])

  // Optimized mouse handling
  const handleMouseClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      for (const node of nodes) {
        const pos = nodePositions.get(node.id)
        if (!pos) continue

        const radius = Math.max(8, Math.min(25, 8 + (node.density / 100) * 17))
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)

        if (distance <= radius) {
          onNodeSelect(node.id)
          return
        }
      }

      onNodeSelect(null)
    },
    [nodes, nodePositions, onNodeSelect],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      let isHovering = false
      for (const node of nodes) {
        const pos = nodePositions.get(node.id)
        if (!pos) continue

        const radius = Math.max(8, Math.min(25, 8 + (node.density / 100) * 17))
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)

        if (distance <= radius) {
          isHovering = true
          break
        }
      }

      canvas.style.cursor = isHovering ? "pointer" : "default"
    },
    [nodes, nodePositions],
  )

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight

        if (nodes.length > 0) {
          const positions = calculateLayout(nodes, canvas.width, canvas.height)
          setNodePositions(positions)
        }
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [nodes, calculateLayout])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer touch-manipulation"
      onClick={handleMouseClick}
      onMouseMove={handleMouseMove}
      style={{ touchAction: "manipulation" }}
    />
  )
})

export default function ConceptMap(props: ConceptMapProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="w-full h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p>Unable to load concept map</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-blue-600 hover:text-blue-800">
              Refresh to try again
            </button>
          </div>
        </div>
      }
    >
      <ConceptMapCanvas {...props} />
    </ErrorBoundary>
  )
}
