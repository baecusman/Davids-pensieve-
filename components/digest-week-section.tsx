"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { ChevronDown } from "lucide-react"

interface DigestWeekSectionProps {
  weekStart: string
  weekEnd: string
  summary: string
  isCurrentWeek?: boolean
  children: React.ReactNode
  itemCount: number
}

export default function DigestWeekSection({
  weekStart,
  weekEnd,
  summary,
  isCurrentWeek = false,
  children,
  itemCount,
}: DigestWeekSectionProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentWeek)
  const [isSticky, setIsSticky] = useState(false)
  const headerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      { threshold: 1, rootMargin: "-1px 0px 0px 0px" },
    )

    if (headerRef.current) {
      observer.observe(headerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const shouldScroll = itemCount > 4

  return (
    <div className="border border-gray-200 rounded-lg bg-white mb-2 overflow-hidden">
      <button
        ref={headerRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-all duration-200 ${
          isCurrentWeek ? "sticky top-0 z-10" : ""
        } ${isSticky && isCurrentWeek ? "bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm" : ""}`}
      >
        <div className="text-left flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            Week of {weekStart} - {weekEnd}
            {isCurrentWeek && (
              <span className="ml-2 text-sm text-blue-600 font-normal animate-in slide-in-from-left duration-300">
                (Current)
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1 font-normal">{itemCount} articles</p>
        </div>
        <div className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
          <ChevronDown className="h-5 w-5 text-gray-500" />
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 pb-4 border-t border-gray-100">
          {/* Week Summary */}
          <div className="py-4 border-b border-gray-100 mb-4">
            <p className="text-gray-700 leading-relaxed font-medium">{summary}</p>
          </div>

          {/* Articles */}
          <div className={shouldScroll ? "max-h-96 overflow-y-auto pr-2" : ""}>{children}</div>

          {shouldScroll && (
            <div className="text-center pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-500">Scroll to see all {itemCount} articles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
