"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  Position,
} from "reactflow"
import "reactflow/dist/style.css"

import { optimizedDatabase } from "@/lib/database/optimized-database" // Assuming this is still the data source
import { performanceMonitor } from "@/lib/performance-monitor"
// ErrorBoundary might wrap this component higher up, or wrap ReactFlow specifically
// import { ErrorBoundary } from "./error-boundary";

// Interfaces for data coming from props/database (original structure)
interface InputConceptNode {
  id: string
  label: string
  type: string // "concept", "person", "organization", "technology", "methodology"
  density: number
  articles: string[]
  description?: string
  source: "analyzed" | "mock" // In lib/concept-map-data.ts, it's just "analyzed"
  frequency?: number
}

interface InputConceptEdge {
  id: string
  source: string // source node id
  target: string // target node id
  type: string // "mentions", "relates_to", "co_occurs"
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
    source: "all" | "analyzed" | "historical" // "historical" might be from a different source than "mock"
  }
}

// Simple custom node example (can be expanded)
const CustomNodeComponent: React.FC<{ data: any, selected: boolean }> = ({ data, selected }) => {
  return (
    <div
      style={{
        padding: "10px",
        border: `2px solid ${selected ? "#000" : "#666"}`,
        borderRadius: "5px",
        background: data.source === "analyzed" ? "#e0f2fe" : "#f3f4f6",
        fontSize: "12px",
        textAlign: "center",
        minWidth: "100px",
      }}
    >
      <div>{data.label}</div>
      {data.type && <div style={{ fontSize: "10px", color: "#555" }}>({data.type})</div>}
      {/* <div style={{ fontSize: "10px", color: "#777" }}>Freq: {data.frequency || 0}</div> */}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNodeComponent,
};


export default function ConceptMap({
  abstractionLevel,
  searchQuery,
  onNodeSelect,
  selectedNodeId, // We'll use this to style selected nodes in react-flow
  filters = { types: [], minFrequency: 1, source: "all" },
}: ConceptMapProps) {
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<InputConceptNode>([])
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<InputConceptEdge>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper for basic layout (circular) - can be replaced with more sophisticated methods
  const calculateInitialPositions = (nodesToLayout: InputConceptNode[], existingNodes: Node<InputConceptNode>[] = []): Node<InputConceptNode>[] => {
    const R = 150 * Math.sqrt(nodesToLayout.length); // Radius scales with number of nodes
    const centerX = typeof window !== "undefined" ? window.innerWidth / 4 : 400; // Initial center X
    const centerY = typeof window !== "undefined" ? window.innerHeight / 4 : 300; // Initial center Y

    return nodesToLayout.map((node, i) => {
      const existingNode = existingNodes.find(n => n.id === node.id);
      if (existingNode?.position) {
        return { ...existingNode }; // Keep existing position if node already rendered
      }
      const angle = (i / nodesToLayout.length) * 2 * Math.PI;
      return {
        id: node.id,
        position: {
          x: centerX + R * Math.cos(angle) + (Math.random() - 0.5) * 50, // Add some jitter
          y: centerY + R * Math.sin(angle) + (Math.random() - 0.5) * 50,
        },
        data: node, // Store all original node data here
        type: 'custom', // Example for custom node
        // style: { opacity: 0 } // Start invisible for staggered animation
      };
    });
  };

  const loadData = useCallback(async () => {
    const timer = performanceMonitor.startTimer("concept-map-loadData")
    setIsLoading(true)
    setError(null)
    try {
      // Fetch data using the existing service (props based)
      const data = await optimizedDatabase.getConceptMapData(abstractionLevel, searchQuery)
      if (!data) throw new Error("No data returned from database")

      let fetchedNodes = data.nodes || []
      if (filters.types.length > 0) {
        fetchedNodes = fetchedNodes.filter((node) => filters.types.includes(node.type))
      }
      if (filters.minFrequency > 1) {
        fetchedNodes = fetchedNodes.filter((node) => (node.frequency || 0) >= filters.minFrequency)
      }
      // Note: 'source' filter from original might need re-evaluation if 'mock' vs 'historical' is different
      if (filters.source !== "all") {
         fetchedNodes = fetchedNodes.filter((node) => node.source === filters.source);
      }

      const nodeIds = new Set(fetchedNodes.map((node) => node.id))
      const fetchedEdges = (data.edges || []).filter(
        (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
      )

      // Transform to React Flow format
      const newRfNodes = calculateInitialPositions(fetchedNodes, rfNodes);

      const newRfEdges = fetchedEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        // label: `${edge.type} (${edge.weight.toFixed(1)})`, // Optional: add label
        // type: 'custom', // Optional: if you have custom edges
        animated: edge.weight > 0.7, // Example: animate heavy edges
        style: { strokeWidth: Math.max(1, edge.weight * 3), opacity: 0.6 },
        data: edge, // Store original edge data
      }))

      setRfNodes(newRfNodes)
      setRfEdges(newRfEdges)

    } catch (err: any) {
      console.error("Error loading concept map data:", err)
      setError(err.message || "Failed to load concept map data")
      performanceMonitor.recordError()
    } finally {
      setIsLoading(false)
      timer()
    }
  }, [abstractionLevel, searchQuery, filters, setRfNodes, setRfEdges, rfNodes]) // Added rfNodes to dep array for positions

  useEffect(() => {
    const timeoutId = setTimeout(loadData, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [loadData])


  const onConnect: OnConnect = useCallback(
    (params) => setRfEdges((eds) => addEdge(params, eds)),
    [setRfEdges],
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.id)
    },
    [onNodeSelect],
  )

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Update selected node style
   const memoizedNodes = useMemo(() => {
    return rfNodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId, // React Flow handles selection internally, this is for custom style
      style: {
        ...node.style,
        border: node.id === selectedNodeId ? "2px solid #000" : node.style?.border,
        // Example: change background if selected (if not using custom node that handles selection)
        // background: node.id === selectedNodeId ? '#aaf' : node.style?.background,
      },
    }));
  }, [rfNodes, selectedNodeId]);


  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-500">Loading Concept Map...</div>
  }
  if (error) {
    return <div className="w-full h-full flex items-center justify-center text-red-500">Error: {error}</div>
  }
   if (rfNodes.length === 0 && !isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
            <p>No concepts found for the current filters.</p>
            <p className="text-sm mt-1">Try adjusting filters or adding more content.</p>
        </div>
      </div>
    );
  }


  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={memoizedNodes}
        edges={rfEdges}
        onNodesChange={onRfNodesChange}
        onEdgesChange={onRfEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick} // Clear selection on pane click
        nodeTypes={nodeTypes} // Register custom node types
        fitView
        attributionPosition="bottom-left"
        className="bg-gradient-to-br from-slate-50 to-stone-100" // Example background
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background gap={16} color="#f0f0f0" />
      </ReactFlow>
    </div>
  )
}
