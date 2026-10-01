'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { euro } from './format';
export function ProjectionChart({
  data,
  compact = false,
}: {
  data: { year: number; value: number; balance: number; equity: number }[];
  compact?: boolean;
}) {
  return (
    <div
      className={`chart ${compact ? 'compact' : ''}`}
      role="img"
      aria-label="Projection de la valeur, du capital restant dû et de l’équité sur 25 ans"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient
              id={compact ? 'equity-small' : 'equity-large'}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#2854db" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#2854db" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e4eaf4" strokeDasharray="3 4" />
          <XAxis
            dataKey="year"
            tickFormatter={(v) => `${v} ans`}
            axisLine={false}
            tickLine={false}
            minTickGap={35}
            tick={{ fontSize: 11, fill: '#59677e' }}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)} k€`}
            axisLine={false}
            tickLine={false}
            width={55}
            tick={{ fontSize: 11, fill: '#59677e' }}
          />
          <Tooltip
            formatter={(v, name) => [euro(Number(v)), name]}
            labelFormatter={(v) => `Année ${v}`}
            contentStyle={{ borderRadius: 12, border: '1px solid #dfe5ef', fontSize: 12 }}
          />
          <Area
            name="Équité"
            type="monotone"
            dataKey="equity"
            stroke="#2854db"
            strokeWidth={2.5}
            fill={`url(#${compact ? 'equity-small' : 'equity-large'})`}
            isAnimationActive={false}
          />
          <Area
            name="Valeur estimée"
            type="monotone"
            dataKey="value"
            stroke="#087d68"
            strokeWidth={2}
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            name="Capital restant dû"
            type="monotone"
            dataKey="balance"
            stroke="#64748b"
            strokeDasharray="5 5"
            fill="transparent"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ComparisonChart({ data }: { data: { name: string; cashflow: number }[] }) {
  return (
    <div className="chart" role="img" aria-label="Comparaison des cash-flows mensuels">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#e4eaf4" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `${v} €`} width={65} />
          <Tooltip formatter={(v) => euro(Number(v))} />
          <Bar
            name="Cash-flow mensuel avant impôt"
            dataKey="cashflow"
            fill="#2854db"
            radius={[5, 5, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CashFlowChart({ data }: { data: { year: number; cashFlow: number }[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#e4eaf4" />
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(v) => `${Math.round(v / 1000)} k€`} />
          <Tooltip formatter={(v) => euro(Number(v))} />
          <Legend />
          <Line
            name="Cash-flow annuel avant impôt"
            dataKey="cashFlow"
            stroke="#2854db"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
