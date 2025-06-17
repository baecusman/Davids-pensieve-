"use client"

import type React from "react"
import { useState, useEffect } from "react"
import ReactFlow, { addEdge, useNodesState, useEdgesState, Controls, MiniMap, type ReactFlowInstance } from "reactflow"
import "reactflow/dist/style.css"
import { initialNodes, initialEdges } from "@/components/concept-map/initial-elements"
import type { AbstractionLevel } from "@/lib/types/abstraction-level"
import { contentService } from "@/lib/services/content-service"
import { useAuth } from "@/components/auth/auth-provider"

const ConceptMapView: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>(initialEdges)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [abstractionLevel, setAbstractionLevel] = useState<AbstractionLevel>("Beginner")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadConceptMap()
    }
  }, [user, abstractionLevel, searchQuery])

  const loadConceptMap = async () => {
    try {
      setLoading(true)
      const mapData = await contentService.getConceptMap(user!.id, abstractionLevel, searchQuery)
      setNodes(mapData.nodes)
      setEdges(mapData.edges)
    } catch (error) {
      console.error("Error loading concept map:", error)
    } finally {
      setLoading(false)
    }
  }

  const onConnect = (params: any) => setEdges((eds) => addEdge(params, eds))

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <div>
        <label htmlFor="abstractionLevel">Abstraction Level:</label>
        <select
          id="abstractionLevel"
          value={abstractionLevel}
          onChange={(e) => setAbstractionLevel(e.target.value as AbstractionLevel)}
        >
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onLoad={setReactFlowInstance}
        fitView
      >
        <Controls />
        <MiniMap />
      </ReactFlow>
      {loading && <div>Loading...</div>}
    </div>
  )
}

export default ConceptMapView
