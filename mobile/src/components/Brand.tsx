import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <View accessibilityLabel="CYF, Clean Your Farm">
      <Text style={[styles.name, compact && styles.compact, inverse && styles.inverse]}>CYF</Text>
      <Text style={[styles.tagline, inverse && styles.inverse]}>CLEAN YOUR FARM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.greenDark, fontFamily: fonts.black, fontSize: 40, letterSpacing: -2, lineHeight: 43 },
  compact: { fontSize: 26, lineHeight: 28, letterSpacing: -1 },
  tagline: { color: colors.green, fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 1.8 },
  inverse: { color: colors.white },
});
