import { useEffect, useLayoutEffect, useRef } from 'react'
import type { State } from '../../engine'
import { useSimulator } from '../../store/useSimulator'
import { layoutGraph, visibleCommits } from './layout'

const COL_W = 108
const LANE_H = 100
const PAD_X = 40
const PAD_Y = 36
const R = 17
const LABEL_H = 22

type Side = 'local' | 'remote'

const COLORS = {
  local: { fill: '#4a86e8', soft: '#dbe9ff', text: '#2c5fb3' },
  remote: { fill: '#2fa875', soft: '#d3f2e3', text: '#1d7a53' },
}

const point = (column: number, lane: number) => ({ x: PAD_X + column * COL_W, y: PAD_Y + lane * LANE_H })

/** 文字数から名札の幅を見積もる（全角は広めに数える） */
function labelWidth(text: string): number {
  let width = 0
  for (const char of text) width += char.charCodeAt(0) > 0xff ? 11.5 : 6.8
  return Math.ceil(width) + 18
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  if (from.y === to.y) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  // 段が変わるところは、子の手前でなめらかに曲げる
  const bendX = Math.max(from.x, to.x - COL_W * 0.75)
  return `M ${from.x} ${from.y} L ${bendX} ${from.y} C ${bendX + COL_W * 0.4} ${from.y}, ${to.x - COL_W * 0.35} ${to.y}, ${to.x} ${to.y}`
}

/** 前回の描画から新しく見えるようになったコミットを覚えておき、登場の仕方を決める */
function useAppearance(state: State, visible: Set<string>, side: Side) {
  const previousVisible = useRef<Set<string> | null>(null)
  const previousAll = useRef<Set<string>>(new Set(Object.keys(state.commits)))

  const animationFor = (id: string): string => {
    if (previousVisible.current === null || previousVisible.current.has(id)) return ''
    // もう片方の側にあったコミットが届いた（push / pull / clone）
    if (previousAll.current.has(id)) return side === 'remote' ? 'graph-from-left' : 'graph-from-right'
    return 'graph-pop'
  }

  useEffect(() => {
    previousVisible.current = visible
    previousAll.current = new Set(Object.keys(state.commits))
  })

  return animationFor
}

export function CommitGraph({ side }: { side: Side }) {
  const sim = useSimulator((s) => s.sim)
  const selected = useSimulator((s) => s.selectedCommits)
  const toggleCommit = useSimulator((s) => s.toggleCommit)
  const scroller = useRef<HTMLDivElement>(null)

  const branches = side === 'local' ? (sim.local?.branches ?? {}) : sim.remote.branches
  const current = side === 'local' ? sim.local?.current : undefined
  const visible = visibleCommits(sim, branches)
  const layout = layoutGraph(sim, side)
  const column = new Map(layout.columns.map((id, index) => [id, index]))
  const pos = (id: string) => point(column.get(id)!, layout.lanes[id])
  const animationFor = useAppearance(sim, visible, side)
  const colors = COLORS[side]

  // 名札を、指しているコミットごとにまとめる
  const labelsAt = new Map<string, string[]>()
  for (const [name, tip] of Object.entries(branches)) labelsAt.set(tip, [...(labelsAt.get(tip) ?? []), name])
  const maxLabels = Math.max(1, ...[...labelsAt.values()].map((names) => names.length))

  const width = PAD_X * 2 + Math.max(0, layout.columns.length - 1) * COL_W + 60
  const height = PAD_Y + (layout.laneCount - 1) * LANE_H + R + 12 + maxLabels * LABEL_H + 8

  // 新しいコミットが増えたら、いちばん右（新しい方）が見えるようにする
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [layout.columns.length])

  return (
    <div ref={scroller} className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label={`${side === 'local' ? '自分のPC' : 'GitHub'} のコミットグラフ`}>
        {/* 親子をつなぐ線 */}
        {layout.columns
          .filter((id) => visible.has(id))
          .flatMap((id) =>
            sim.commits[id].parents
              .filter((parent) => visible.has(parent))
              .map((parent) => (
                <path
                  key={`${parent}-${id}`}
                  d={edgePath(pos(parent), pos(id))}
                  fill="none"
                  stroke={colors.fill}
                  strokeOpacity={0.45}
                  strokeWidth={3}
                  className={`graph-anim ${animationFor(id)}`}
                />
              )),
          )}

        {/* コミット */}
        {layout.columns.map((id) => {
          const { x, y } = pos(id)
          const commit = sim.commits[id]
          if (!visible.has(id)) {
            // もう片方にだけあるコミット。ここにはまだ無いことを点線で見せる
            return (
              <g key={id}>
                <title>{`コミット ${id} は${side === 'local' ? '自分のPC' : 'GitHub'}にはまだありません`}</title>
                <circle cx={x} cy={y} r={R} fill="none" stroke="#c9c2b8" strokeDasharray="4 4" strokeWidth={2} />
              </g>
            )
          }
          const isSelected = selected.includes(id)
          const isTeammate = commit.author === 'teammate'
          return (
            <g
              key={id}
              className={`graph-anim cursor-pointer ${animationFor(id)}`}
              onClick={() => toggleCommit(id)}
              role="button"
              aria-pressed={isSelected}
              aria-label={`コミット ${id}: ${commit.message}`}
            >
              <title>{`コミット ${id}: ${commit.message}${isTeammate ? '（チームメイト）' : ''}\nクリックで選択`}</title>
              {isSelected && <circle cx={x} cy={y} r={R + 6} fill="none" stroke="#fb923c" strokeWidth={3} />}
              <circle
                cx={x}
                cy={y}
                r={R}
                fill={isTeammate ? colors.soft : colors.fill}
                stroke={colors.fill}
                strokeWidth={isTeammate ? 2.5 : 0}
              />
              {commit.parents.length > 1 && <circle cx={x} cy={y} r={R - 5} fill="none" stroke="white" strokeWidth={1.5} />}
              <text
                x={x}
                y={y + 4.5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill={isTeammate ? colors.text : 'white'}
              >
                {id}
              </text>
            </g>
          )
        })}

        {/* 名札（ブランチ）。指す先が変わると滑らかに移動する */}
        {[...labelsAt.entries()].flatMap(([tip, names]) => {
          const { x, y } = pos(tip)
          const ordered = [...names].sort((a, b) => Number(b === current) - Number(a === current))
          return ordered.map((name, index) => {
            const isCurrent = name === current
            const text = isCurrent ? `今ここ: ${name}` : name
            const w = labelWidth(text)
            return (
              <g
                key={`label-${name}`}
                style={{
                  // 左端のコミットに長い名札が付いても欠けないようにする
                  transform: `translate(${Math.max(4, x - w / 2)}px, ${y + R + 8 + index * LABEL_H}px)`,
                  transition: 'transform 450ms ease',
                }}
              >
                <rect
                  width={w}
                  height={LABEL_H - 4}
                  rx={9}
                  fill={isCurrent ? colors.fill : colors.soft}
                  stroke={colors.fill}
                  strokeWidth={isCurrent ? 0 : 1}
                />
                <text x={w / 2} y={13} textAnchor="middle" fontSize={11} fontWeight={700} fill={isCurrent ? 'white' : colors.text}>
                  {text}
                </text>
              </g>
            )
          })
        })}
      </svg>
    </div>
  )
}
