import { StyleSheet, Text, View } from "react-native";
import type { DashboardRow } from "../analytics";
import { colors, fonts } from "../theme";

const SEGMENTS = 72;

export function PieChart({ rows, size = 210 }: { rows: DashboardRow[]; size?: number }) {
  const positive = rows.filter((row) => row.count > 0);
  const total = positive.reduce((sum, row) => sum + row.count, 0);
  const radius = size * 0.36;
  const markerWidth = Math.max(8, size * 0.047);
  const markerHeight = Math.max(15, size * 0.105);
  const center = size / 2;
  const cumulative = positive.reduce<Array<{ end: number; color: string }>>((items, row) => {
    const previous = items.at(-1)?.end ?? 0;
    items.push({ end: previous + row.count / Math.max(total, 1), color: row.color });
    return items;
  }, []);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Gráfico de pizza com ${total} detecções`}
      style={[styles.chart, { width: size, height: size }]}
    >
      {Array.from({ length: SEGMENTS }, (_, index) => {
        const share = (index + 0.5) / SEGMENTS;
        const angle = (index / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        const color = total === 0 ? colors.green : cumulative.find((item) => share <= item.end)?.color ?? colors.green;
        return (
          <View
            key={index}
            style={{
              position: "absolute",
              left: center + Math.cos(angle) * radius - markerWidth / 2,
              top: center + Math.sin(angle) * radius - markerHeight / 2,
              width: markerWidth,
              height: markerHeight,
              borderRadius: markerWidth / 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle + Math.PI / 2}rad` }],
            }}
          />
        );
      })}
      <View style={[styles.center, { width: size * 0.49, height: size * 0.49, borderRadius: size * 0.245 }]}>
        <Text style={styles.total}>{total}</Text>
        <Text style={styles.label}>DETECÇÕES</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  total: { color: colors.ink, fontFamily: fonts.black, fontSize: 29, lineHeight: 34 },
  label: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10 },
});
