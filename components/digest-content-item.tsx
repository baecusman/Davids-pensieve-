"use client"

import { useState } from "react"
import { Bookmark, ExternalLink, Eye, Zap, BookOpen, Scan } from "lucide-react"

type Priority = "skim" | "read" | "deep-dive"

interface DigestContentItemProps {
  title: string
  summary: string
  fullSummary?: string
  summaryType: "sentence" | "paragraph" | "full-read"
  priority: Priority
  isNew?: boolean
  url?: string
  conceptTags?: string[]
  onTagClick?: (tag: string) => void
  onFullReadClick?: () => void
}

const priorityConfig = {
  skim: {
    icon: Scan,
    label: "Quick Scan",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    description: "Key points only",
  },
  read: {
    icon: BookOpen,
    label: "Worth Reading",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    description: "Important insights",
  },
  "deep-dive": {
    icon: Zap,
    label: "Deep Dive",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    description: "Critical analysis",
  },
}

export default function DigestContentItem({
  title,
  summary,
  fullSummary,
  summaryType,
  priority,
  isNew = false,
  url,
  conceptTags = [],
  onTagClick,
  onFullReadClick,
}: DigestContentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showTags, setShowTags] = useState(false)

  const canExpand = summaryType === "sentence" && fullSummary
  const displaySummary = isExpanded && fullSummary ? fullSummary : summary
  const priorityInfo = priorityConfig[priority]
  const PriorityIcon = priorityInfo.icon

  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-300 mb-2 hover:shadow-sm ${
        isNew ? "bg-blue-50 border-blue-200 animate-in fade-in duration-500" : "bg-gray-50 border-gray-100"
      }`}
      onMouseEnter={() => setShowTags(true)}
      onMouseLeave={() => setShowTags(false)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          {/* Priority Flag */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${priorityInfo.bgColor} ${priorityInfo.color} shrink-0`}
            title={priorityInfo.description}
          >
            <PriorityIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{priorityInfo.label}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 flex items-center gap-1"
                >
                  {title}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              ) : (
                title
              )}
              {summaryType === "full-read" && (
                <button
                  onClick={onFullReadClick}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                  title="Open full article"
                >
                  <Bookmark className="h-4 w-4" />
                  <Eye className="h-3 w-3" />
                </button>
              )}
              {isNew && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-in slide-in-from-right duration-300">
                  New
                </span>
              )}
            </h4>
          </div>
        </div>
      </div>

      <div className="overflow-hidden ml-0 sm:ml-16">
        <p
          className={`text-gray-700 transition-all duration-200 ease-out ${
            summaryType === "sentence" ? "text-sm" : "text-base"
          } ${canExpand ? "cursor-pointer hover:text-gray-900" : ""}`}
          onClick={() => canExpand && setIsExpanded(!isExpanded)}
          style={{
            height: isExpanded ? "auto" : undefined,
          }}
        >
          {displaySummary}
          {canExpand && !isExpanded && (
            <span className="text-blue-600 ml-1 text-xs font-medium hover:underline">...expand</span>
          )}
        </p>
      </div>

      {/* Concept Tags */}
      {conceptTags.length > 0 && (
        <div className={`mt-3 ml-0 sm:ml-16 transition-all duration-200 ${showTags ? "opacity-100" : "opacity-60"}`}>
          <div className="flex flex-wrap gap-1">
            {conceptTags.slice(0, 3).map((tag, index) => (
              <button
                key={tag}
                onClick={() => onTagClick?.(tag)}
                className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all duration-150 transform hover:scale-105"
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
