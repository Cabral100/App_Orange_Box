import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CONFIRMED_THRESHOLD } from "../analytics";
import type { InspectionRecord, Plot } from "../types";
import { colors, fonts, radii, shadow } from "../theme";

type Props = {
  record: InspectionRecord;
  plot: Plot | null;
  onUseExistingPlot: () => Promise<void>;
  onCreatePlotByArea: (areaSquareMeters: number, name: string) => Promise<void>;
  onDrawPlot: () => Promise<void>;
  onNext: () => void;
  onRetake: () => void;
};

export function InspectionResultScreen({ record, plot, onUseExistingPlot, onCreatePlotByArea, onDrawPlot, onNext, onRetake }: Props) {
  const [mapping, setMapping] = useState(false);
  const [area, setArea] = useState("10000");
  const [plotName, setPlotName] = useState(plot?.name || "Talhão da inspeção");
  const [saving, setSaving] = useState(false);
  const count = record.detections.filter((detection) => detection.confidence >= CONFIRMED_THRESHOLD).length;
  const detected = count > 0;
  const confidence = Math.round(record.topConfidence * 100);

  async function createByArea() {
    const parsed = Number(area.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 25) {
      Alert.alert("Área inválida", "Informe pelo menos 25 m².");
      return;
    }
    setSaving(true);
    try { await onCreatePlotByArea(parsed, plotName.trim() || "Talhão da inspeção"); }
    catch (error) { Alert.alert("Não foi possível delimitar", error instanceof Error ? error.message : "Revise a área informada."); }
    finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.handle} />
      <View style={styles.photoWrap}>
        <Image source={{ uri: record.imageUri }} style={styles.photo} />
        {record.detections.map((detection, index) => <View key={`${detection.bbox.x1}-${index}`} style={[styles.box, {
          left: `${detection.bbox.x1 / 640 * 100}%`, top: `${detection.bbox.y1 / 640 * 100}%`,
          width: `${(detection.bbox.x2 - detection.bbox.x1) / 640 * 100}%`, height: `${(detection.bbox.y2 - detection.bbox.y1) / 640 * 100}%`,
        }]} />)}
      </View>

      <View style={[styles.alert, detected ? styles.alertDanger : styles.alertClear]}>
        <MaterialCommunityIcons name={detected ? "alert" : "check-circle"} size={45} color={detected ? colors.red : colors.green} />
        <View style={{ flex: 1 }}><Text style={[styles.alertTitle, { color: detected ? colors.red : colors.green }]}>{detected ? `${count} ácaro(s) detectado(s)` : "Nenhuma praga confirmada"}</Text><Text style={styles.alertCopy}>{detected ? `Confiança ${confidence}%` : "Vistoria registrada com zero ocorrência"}</Text></View>
      </View>

      <View style={styles.details}>
        <Detail icon="map-marker-radius" title={plot?.name || "Talhão ainda não delimitado"} />
        <Detail icon="crosshairs-gps" title={record.location ? `${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}` : "Foto sem coordenada"} />
        <Detail icon="clock-outline" title={new Date(record.capturedAt).toLocaleString("pt-BR")} last />
      </View>

      <Pressable onPress={() => setMapping(true)} style={styles.primary}><MaterialCommunityIcons name="map-marker-plus" size={23} color={colors.white} /><Text style={styles.primaryText}>Marcar talhão no mapa</Text></Pressable>
      <Pressable onPress={onNext} style={styles.secondary}><MaterialCommunityIcons name="arrow-right" size={22} color={colors.orange} /><Text style={styles.secondaryText}>Próxima árvore</Text></Pressable>
      <Pressable onPress={onRetake} style={styles.tertiary}><MaterialCommunityIcons name="refresh" size={22} color={colors.muted} /><Text style={styles.tertiaryText}>Refazer foto e apagar registro</Text></Pressable>

      <Modal visible={mapping} transparent animationType="slide" onRequestClose={() => setMapping(false)}>
        <View style={styles.modalShade}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><View><Text style={styles.modalOverline}>LOCALIZAÇÃO DA INSPEÇÃO</Text><Text style={styles.modalTitle}>Como delimitar?</Text></View><Pressable accessibilityLabel="Fechar" onPress={() => setMapping(false)}><MaterialCommunityIcons name="close" size={27} color={colors.ink} /></Pressable></View>
          <Text style={styles.modalCopy}>Você pode desenhar o contorno no satélite ou informar a área total para criar um limite circular ao redor do GPS/EXIF.</Text>

          {plot ? <Pressable onPress={onUseExistingPlot} style={styles.existing}><MaterialCommunityIcons name="map-check" size={23} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Usar {plot.name}</Text><Text style={styles.optionCopy}>A coordenada já está dentro deste limite.</Text></View><MaterialCommunityIcons name="chevron-right" size={23} color={colors.muted} /></Pressable> : null}

          <Pressable onPress={onDrawPlot} style={styles.option}><View style={styles.optionIcon}><MaterialCommunityIcons name="vector-polygon" size={23} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Desenhar manualmente</Text><Text style={styles.optionCopy}>Marque os cantos diretamente sobre o mapa.</Text></View><MaterialCommunityIcons name="chevron-right" size={23} color={colors.muted} /></Pressable>

          <View style={styles.areaCard}><View style={styles.areaHead}><View style={styles.optionIcon}><MaterialCommunityIcons name="ruler-square" size={23} color={colors.orange} /></View><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Informar área do talhão</Text><Text style={styles.optionCopy}>O limite será centralizado na foto.</Text></View></View>
            <TextInput accessibilityLabel="Nome do talhão" value={plotName} onChangeText={setPlotName} placeholder="Nome do talhão" style={styles.input} />
            <View style={styles.areaInputRow}><TextInput accessibilityLabel="Área em metros quadrados" value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="Ex.: 10000" style={[styles.input, styles.areaInput]} /><Text style={styles.unit}>m²</Text></View>
            <Pressable disabled={!record.location || saving} onPress={createByArea} style={[styles.areaButton, (!record.location || saving) && styles.disabled]}><Text style={styles.areaButtonText}>{saving ? "Delimitando…" : "Criar limite pela área"}</Text></Pressable>
            {!record.location ? <Text style={styles.locationError}>Esta foto não possui GPS/EXIF. Use o desenho manual.</Text> : null}
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

function Detail({ icon, title, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; last?: boolean }) {
  return <View style={[styles.detail, last && styles.detailLast]}><MaterialCommunityIcons name={icon} size={23} color={colors.green} /><Text numberOfLines={2} style={styles.detailText}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { padding: 14, paddingTop: 17, paddingBottom: 38 }, handle: { width: 45, height: 5, borderRadius: 3, backgroundColor: "#C9C8C3", alignSelf: "center", marginBottom: 17 },
  photoWrap: { width: "100%", aspectRatio: 1.38, borderRadius: 25, overflow: "hidden", backgroundColor: "#DDD" }, photo: { width: "100%", height: "100%" }, box: { position: "absolute", borderWidth: 3, borderColor: colors.orange, borderRadius: 7, backgroundColor: "rgba(233,78,11,0.09)" },
  alert: { marginTop: 15, borderRadius: radii.medium, padding: 17, flexDirection: "row", alignItems: "center", gap: 14 }, alertDanger: { backgroundColor: "#FCE7E3" }, alertClear: { backgroundColor: colors.greenSoft }, alertTitle: { fontFamily: fonts.extraBold, fontSize: 19 }, alertCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  details: { marginTop: 14, backgroundColor: colors.white, borderRadius: radii.medium, paddingHorizontal: 16, ...shadow }, detail: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, detailLast: { borderBottomWidth: 0 }, detailText: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  primary: { marginTop: 23, height: 59, borderRadius: radii.pill, backgroundColor: colors.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 }, secondary: { marginTop: 10, height: 56, borderRadius: radii.pill, borderWidth: 1, borderColor: "#E6CDBE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: colors.white }, secondaryText: { color: colors.orange, fontFamily: fonts.bold, fontSize: 14 }, tertiary: { marginTop: 7, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, tertiaryText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,20,12,0.65)" }, modalCard: { maxHeight: "90%", borderTopLeftRadius: 31, borderTopRightRadius: 31, padding: 20, paddingBottom: 30, backgroundColor: colors.paper }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalOverline: { color: colors.greenDark, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.3 }, modalTitle: { color: colors.ink, fontFamily: fonts.black, fontSize: 29, marginTop: 3 }, modalCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 14 },
  existing: { minHeight: 78, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.greenSoft, marginBottom: 9 }, option: { minHeight: 80, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.lineStrong }, optionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenSoft }, optionTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 15 }, optionCopy: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, marginTop: 2 },
  areaCard: { marginTop: 9, borderRadius: 20, padding: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, areaHead: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 11 }, input: { height: 47, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FAFBF8", paddingHorizontal: 13, color: colors.ink, fontFamily: fonts.medium, fontSize: 12 }, areaInputRow: { flexDirection: "row", alignItems: "center", marginTop: 8 }, areaInput: { flex: 1, paddingRight: 42 }, unit: { position: "absolute", right: 14, color: colors.muted, fontFamily: fonts.bold, fontSize: 12 }, areaButton: { height: 48, borderRadius: radii.pill, marginTop: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange }, areaButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 }, disabled: { opacity: 0.45 }, locationError: { color: colors.red, fontFamily: fonts.medium, fontSize: 9, marginTop: 7, textAlign: "center" },
});
