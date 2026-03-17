"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface RiskMetric {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

export interface RiskMetricsProps {
  drawdown: RiskMetric;
  dailyLoss: RiskMetric;
}

function MetricBar({ metric }: { metric: RiskMetric }) {
  const ratio = metric.limit > 0 ? metric.current / metric.limit : 0;
  const fillPercent = Math.min(ratio * 100, 100);
  const isWarning = ratio >= 0.8;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{metric.label}</span>
        <span className="text-white">
          {metric.current.toFixed(2)}
          {metric.unit ?? "%"} /{" "}
          {metric.limit.toFixed(2)}
          {metric.unit ?? "%"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isWarning ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}

export function RiskMetrics({ drawdown, dailyLoss }: RiskMetricsProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Risk Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MetricBar metric={drawdown} />
        <MetricBar metric={dailyLoss} />
      </CardContent>
    </Card>
  );
}
