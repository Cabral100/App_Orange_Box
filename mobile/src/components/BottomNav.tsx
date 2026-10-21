import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TabId } from "../types";
import { colors, radii, shadow } from "../theme";

const tabs: { id: TabId; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: "map", label: "Mapa", icon: "map-outline" },
  { id: "history", label: "Histórico", icon: "history" },
  { id: "camera", label: "Câmera", icon: "camera-outline" },
  { id: "dashboard", label: "Relatórios", icon: "chart-pie" },
  { id: "account", label: "Conta", icon: "account-outline" },
];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <View style={styles.shell} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const camera = tab.id === "camera";
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.item, camera && styles.cameraItem, selected && !camera && styles.selected, pressed && styles.pressed]}
          >
            <View style={camera ? [styles.cameraButton, selected && styles.cameraButtonActive] : undefined}>
              <MaterialCommunityIcons name={tab.icon} size={camera ? 30 : 24} color={camera ? colors.white : selected ? colors.green : colors.muted} />
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel, camera && styles.cameraLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute", left: 12, right: 12, bottom: 9, height: 76,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: radii.large,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", ...shadow,
  },
  item: { flex: 1, height: 62, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 22 },
  cameraItem: { transform: [{ translateY: -15 }], overflow: "visible" },
  cameraButton: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange, ...shadow },
  cameraButtonActive: { backgroundColor: colors.green },
  selected: { backgroundColor: colors.white },
  pressed: { opacity: 0.72 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  selectedLabel: { color: colors.green, fontWeight: "800" },
  cameraLabel: { marginTop: 0, color: colors.orange },
});
