import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TabId, UserRole } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

type Tab = { id: TabId; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap };

const mapTab: Tab = { id: "map", label: "Mapa", icon: "map-outline" };
const historyTab: Tab = { id: "history", label: "Histórico", icon: "history" };
const cameraTab: Tab = { id: "camera", label: "Câmera", icon: "camera-outline" };
const dashboardTab: Tab = { id: "dashboard", label: "Relatórios", icon: "chart-pie" };
const accountTab: Tab = { id: "account", label: "Conta", icon: "account-outline" };

export function BottomNav({ active, onChange, role }: { active: TabId; onChange: (tab: TabId) => void; role: UserRole }) {
  const leftTabs = [mapTab, historyTab];
  const rightTabs = role === "admin" ? [dashboardTab, accountTab] : [accountTab];
  return (
    <View style={styles.shell} accessibilityRole="tablist">
      <View style={styles.side}>{leftTabs.map((tab) => <NavItem key={tab.id} tab={tab} active={active} onChange={onChange} />)}</View>
      <NavItem tab={cameraTab} active={active} onChange={onChange} camera />
      <View style={styles.side}>{rightTabs.map((tab) => <NavItem key={tab.id} tab={tab} active={active} onChange={onChange} />)}</View>
    </View>
  );
}

function NavItem({ tab, active, onChange, camera = false }: { tab: Tab; active: TabId; onChange: (tab: TabId) => void; camera?: boolean }) {
  const selected = tab.id === active;
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected }}
    accessibilityLabel={tab.label}
    onPress={() => onChange(tab.id)}
    style={({ pressed }) => [styles.item, camera && styles.cameraItem, selected && !camera && styles.selected, pressed && styles.pressed]}
  >
    <View style={camera ? [styles.cameraButton, selected && styles.cameraButtonActive] : undefined}>
      <MaterialCommunityIcons name={tab.icon} size={camera ? 34 : 24} color={camera ? colors.white : selected ? colors.green : colors.muted} />
    </View>
    <Text style={[styles.label, selected && styles.selectedLabel, camera && styles.cameraLabel]}>{tab.label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute", left: 12, right: 12, bottom: 9, height: 76,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: radii.large,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", ...shadow,
  },
  side: { flex: 1, height: 62, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  item: { flex: 1, minWidth: 54, height: 62, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 22 },
  cameraItem: { flex: 0, width: 76, transform: [{ translateY: -18 }], overflow: "visible" },
  cameraButton: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange, ...shadow },
  cameraButtonActive: { backgroundColor: colors.green },
  selected: { backgroundColor: colors.white },
  pressed: { opacity: 0.72 },
  label: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 },
  selectedLabel: { color: colors.green, fontFamily: fonts.extraBold },
  cameraLabel: { marginTop: 0, color: colors.orange },
});
