import { useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Forecast, ForecastPoint } from '../../lib/types'
import { formatCompact, formatCurrency } from '../../lib/format'

const SERIES_1 = '#2a78d6'
const SERIES_2 = '#eb6834'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'
const MUTED = '#898781'

const STATUS = {
  ok: { label: 'Above safety buffer', icon: CheckCircle2, color: '#0ca30c' },
  low: { label: 'Below safety buffer', icon: AlertTriangle, color: '#ec835a' },
  shortfall: { label: 'Cash runs out', icon: AlertOctagon, color: '#d03b3b' },
} as const

const axisProps = {
  tick: { fill: MUTED, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: AXIS },
}

function StatusLine({ status }: { status: ForecastPoint['status'] }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span className="mt-1 flex items-center gap-1 text-xs text-gray-700">
      <Icon className="h-3.5 w-3.5" style={{ color: s.color }} aria-hidden /> {s.label}
    </span>
  )
}

function ForecastTooltip({ active, payload }: { active?: boolean; payload?: { payload: ForecastPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="max-w-[240px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-900">{p.label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{formatCurrency(p.balance)}</p>
      <p className="text-gray-500">In {formatCurrency(p.inflow)} · Out {formatCurrency(p.outflow)}</p>
      {p.events.length > 0 && <p className="mt-1 text-gray-600">{p.events.join(', ')}</p>}
      <StatusLine status={p.status} />
    </div>
  )
}

/** Dots only where the month needs attention — marker ≥ 8px with a 2px surface ring. */
function StatusDot(props: { cx?: number; cy?: number; payload?: ForecastPoint }) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload || payload.status === 'ok') return <g />
  return <circle cx={cx} cy={cy} r={5} fill={STATUS[payload.status].color} stroke="#fff" strokeWidth={2} />
}

export function ForecastChart({ forecast, height = 260 }: { forecast: Forecast; height?: number }) {
  const [showTable, setShowTable] = useState(false)
  const data = forecast.points
  const min = Math.min(0, ...data.map((d) => d.balance))

  return (
    <div>
      {showTable ? (
        <ForecastTable forecast={forecast} />
      ) : (
        <div style={{ height }} aria-label="Projected month-end bank balance">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} axisLine={false} tickFormatter={formatCompact} width={56}
                     domain={[min < 0 ? 'dataMin' : 0, 'auto']} />
              <ReferenceLine y={forecast.safety_buffer} stroke={MUTED} strokeDasharray="4 4"
                             label={{ value: 'Safety buffer', position: 'insideTopRight', fill: MUTED, fontSize: 11 }} />
              {min < 0 && <ReferenceLine y={0} stroke={AXIS} />}
              <Tooltip content={<ForecastTooltip />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
              <Area type="monotone" dataKey="balance" name="Balance" stroke={SERIES_1} strokeWidth={2}
                    fill="url(#balanceFill)" dot={<StatusDot />} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <button onClick={() => setShowTable((s) => !s)}
              className="mt-2 text-xs text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline">
        {showTable ? 'Show chart' : 'Show as table'}
      </button>
    </div>
  )
}

function ForecastTable({ forecast }: { forecast: Forecast }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="py-2 pr-3 font-medium">Month</th>
            <th className="py-2 pr-3 text-right font-medium">In</th>
            <th className="py-2 pr-3 text-right font-medium">Out</th>
            <th className="py-2 pr-3 text-right font-medium">Balance</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {forecast.points.map((p) => (
            <tr key={p.month} className="border-b border-gray-100">
              <td className="py-2 pr-3">{p.label}</td>
              <td className="py-2 pr-3 text-right">{formatCurrency(p.inflow)}</td>
              <td className="py-2 pr-3 text-right">{formatCurrency(p.outflow)}</td>
              <td className="py-2 pr-3 text-right font-medium">{formatCurrency(p.balance)}</td>
              <td className="py-2"><StatusLine status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Baseline vs scenario — two series, legend + direct end labels, one shared axis. */
export function ScenarioChart({ baseline, scenario, height = 280 }: {
  baseline: Forecast; scenario: Forecast; height?: number
}) {
  const data = baseline.points.map((b, i) => ({
    label: b.label,
    baseline: b.balance,
    scenario: scenario.points[i]?.balance ?? null,
    status: scenario.points[i]?.status ?? 'ok',
  }))
  const last = data[data.length - 1]

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-gray-600" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SERIES_1 }} />With changes</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SERIES_2 }} />Current path</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed" style={{ borderColor: MUTED }} />Safety buffer</span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 72, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} axisLine={false} tickFormatter={formatCompact} width={56} />
            <ReferenceLine y={baseline.safety_buffer} stroke={MUTED} strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke={AXIS} />
            <Tooltip
              cursor={{ stroke: AXIS, strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-gray-900">{label}</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 text-gray-700">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                        {p.dataKey === 'scenario' ? 'With changes' : 'Current path'}:
                        <span className="font-medium text-gray-900">{formatCurrency(p.value as number)}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            <Line type="monotone" dataKey="baseline" stroke={SERIES_2} strokeWidth={2} dot={false}
                  activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                  label={(p: { index: number; x: number; y: number }) =>
                    p.index === data.length - 1 ? (
                      <text x={p.x + 8} y={p.y} dy={4} fontSize={11} fill="#52514e">Current {formatCompact(last.baseline)}</text>
                    ) : <g />} />
            <Line type="monotone" dataKey="scenario" stroke={SERIES_1} strokeWidth={2} dot={false}
                  activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                  label={(p: { index: number; x: number; y: number }) =>
                    p.index === data.length - 1 && last.scenario !== null ? (
                      <text x={p.x + 8} y={p.y} dy={4} fontSize={11} fill="#0b0b0b">New {formatCompact(last.scenario)}</text>
                    ) : <g />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
