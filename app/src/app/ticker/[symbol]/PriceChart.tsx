"use client";

interface ChartData {
  date: string;
  close: number;
  high: number;
  low: number;
}

interface PriceChartProps {
  data: ChartData[];
}

export function PriceChart({ data }: PriceChartProps) {
  if (data.length < 2) {
    return <p style={{ color: "var(--muted)" }}>Not enough data to display chart.</p>;
  }

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 60, bottom: 40, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max for y-axis
  const allPrices = data.flatMap((d) => [d.high, d.low, d.close]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const yMin = minPrice - priceRange * 0.05;
  const yMax = maxPrice + priceRange * 0.05;

  // Scale functions
  const xScale = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const yScale = (price: number) => padding.top + ((yMax - price) / (yMax - yMin)) * chartHeight;

  // Create line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.close)}`)
    .join(" ");

  // Create area path
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(yMin)} L ${xScale(0)} ${yScale(yMin)} Z`;

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const value = yMin + ((yMax - yMin) * i) / (yTicks - 1);
    return { value, y: yScale(value) };
  });

  // X-axis labels (show every ~month)
  const xLabels: { label: string; x: number }[] = [];
  const monthInterval = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += monthInterval) {
    const d = data[i];
    if (d) {
      const date = new Date(d.date);
      xLabels.push({
        label: date.toLocaleDateString("en-US", { month: "short" }),
        x: xScale(i),
      });
    }
  }

  // Current price info
  const lastDataPoint = data[data.length - 1];
  const firstDataPoint = data[0];

  if (!lastDataPoint || !firstDataPoint) {
    return <p style={{ color: "var(--muted)" }}>Not enough data to display chart.</p>;
  }

  const currentPrice = lastDataPoint.close;
  const startPrice = firstDataPoint.close;
  const changePercent = ((currentPrice - startPrice) / startPrice) * 100;
  const isPositive = changePercent >= 0;

  return (
    <div>
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.75rem" }}>
        <div>
          <span style={labelStyle}>Current</span>
          <span style={{ fontSize: "1.25rem", fontWeight: "bold" }}>${currentPrice.toFixed(2)}</span>
        </div>
        <div>
          <span style={labelStyle}>Change (6M)</span>
          <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: isPositive ? "var(--success)" : "var(--danger)" }}>
            {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
        </div>
        <div>
          <span style={labelStyle}>High</span>
          <span>${maxPrice.toFixed(2)}</span>
        </div>
        <div>
          <span style={labelStyle}>Low</span>
          <span>${minPrice.toFixed(2)}</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {yLabels.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="var(--border)"
            strokeDasharray="2,2"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="rgba(59, 130, 246, 0.1)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={isPositive ? "var(--success)" : "var(--danger)"}
          strokeWidth="2"
        />

        {/* Y-axis labels */}
        {yLabels.map((tick, i) => (
          <text
            key={i}
            x={width - padding.right + 8}
            y={tick.y}
            fontSize="10"
            fill="var(--muted)"
            dominantBaseline="middle"
          >
            ${tick.value.toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - padding.bottom + 20}
            fontSize="10"
            fill="var(--muted)"
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}

        {/* Current price dot */}
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(currentPrice)}
          r="4"
          fill={isPositive ? "var(--success)" : "var(--danger)"}
        />
      </svg>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};
