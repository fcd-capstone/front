import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const elapsedText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export default function SensorChart({
  chart,
  position,
  timeDomain = [0, 120],
  timestampMode = false,
}: {
  chart: { t: number; a: number | null; b: number | null }[];
  position: number;
  timeDomain?: [number, number];
  timestampMode?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chart}
        margin={{ top: 10, right: 20, left: -16, bottom: 4 }}
      >
        <CartesianGrid
          stroke="#24313d"
          strokeDasharray="3 5"
          vertical={false}
        />
        <XAxis
          dataKey="t"
          type="number"
          domain={timeDomain}
          ticks={timestampMode ? undefined : [0, 30, 60, 90, 120]}
          tickFormatter={
            timestampMode
              ? (ts) =>
                  new Date(ts * 1000).toLocaleTimeString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    hour12: false,
                  })
              : elapsedText
          }
          stroke="#647587"
          tickLine={false}
          axisLine={false}
          fontSize={11}
        />
        <YAxis
          stroke="#647587"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          domain={["auto", "auto"]}
        />
        <Tooltip
          labelFormatter={(v) =>
            timestampMode
              ? new Date(Number(v) * 1000).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  hour12: false,
                })
              : `재생 ${elapsedText(Number(v))}`
          }
          contentStyle={{
            background: "#15212d",
            border: "1px solid #344456",
            borderRadius: 8,
            color: "#e9f0f7",
          }}
        />
        {!timestampMode && position >= 30 && (
          <ReferenceArea
            x1={30}
            x2={position}
            fill="#e4a448"
            fillOpacity={0.05}
          />
        )}
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
        />
        <Line
          name="노드 A · 기준"
          type="monotone"
          dataKey="a"
          stroke="#50d6b0"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Line
          name="노드 B · 도어"
          type="monotone"
          dataKey="b"
          stroke="#739cf8"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
