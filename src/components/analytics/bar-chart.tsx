'use client'

import { useMemo } from 'react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

interface BarChartProps {
  data: number[]
  labels?: string[]
  color?: string
  height?: number
  className?: string
}

/**
 * Simple SVG-based bar chart for analytics dashboards.
 * Used by the team velocity dashboard and other analytics views.
 */
export function BarChart({
  data,
  labels = [],
  color = '#6366f1',
  height = 200,
  className,
}: BarChartProps) {
  const max = Math.max(...data, 1)
  const padding = 8
  const labelHeight = 24
  const chartHeight = height - labelHeight - padding * 2

  const barWidth = Math.max(4, (320 - padding * 2) / Math.max(data.length, 1) - 4)

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ height: `${height}px` }}
    >
      {/* Y-axis grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {[0, 25, 50, 75, 100].map((pct) => {
          const value = (max * pct) / 100
          return (
            <div
              key={pct}
              className="absolute right-0 border-t border-border/30 text-xs text-muted-foreground"
              style={{ width: '100%', top: `${chartHeight * (1 - pct / 100)}px` }}
            >
              <span className="absolute right-1 -translate-y-1/2">{Math.round(value)}</span>
            </div>
          )
        })}
      </div>

      {/* Bars */}
      <svg
        width="100%"
        height={height}
        className="absolute inset-0"
        preserveAspectRatio="xMidYMin"
        viewBox={`0 0 ${320} ${height}`}
      >
        {data.map((value, i) => {
          const barHeight = (value / max) * chartHeight
          const x = padding + i * ((320 - padding * 2) / Math.max(data.length, 1))

          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight + padding - barHeight}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={color}
                opacity={0.8}
              >
                <animate
                  attributeName="opacity"
                  values={`0;0.8`}
                  dur="0.3s"
                  fill="freeze"
                />
              </rect>
            </g>
          )
        })}
      </svg>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="absolute bottom-0 flex justify-between px-2">
          {labels.map((label, i) => {
            const translateX = padding + i * ((320 - padding * 2) / Math.max(data.length, 1)) + barWidth / 2
            return (
              <span
                key={i}
                className="text-xs text-muted-foreground transform -rotate-45 origin-top-left"
                style={{ transformOrigin: `${translateX}px top` }}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
