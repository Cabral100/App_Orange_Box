import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const buildFile = resolve("node_modules/onnxruntime-react-native/android/build.gradle");
const unsupported = 'if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {';
const compatible = 'if (REACT_NATIVE_VERSION.startsWith("0.") && REACT_NATIVE_MINOR_VERSION < 71) {';
const dynamicAndroidArtifact = "latest.integration@aar";
const pinnedAndroidArtifact = "1.24.3@aar";

try {
  const source = await readFile(buildFile, "utf8");
  let adjusted = source.replace(unsupported, compatible).replaceAll(dynamicAndroidArtifact, pinnedAndroidArtifact);
  if (adjusted !== source) {
    await writeFile(buildFile, adjusted, "utf8");
    process.stdout.write("ONNX Runtime ajustado e artefatos Android fixados em 1.24.3.\n");
  } else if (!source.includes(compatible)) {
    process.stdout.write("ONNX Runtime já usa outra implementação de versão; nenhum ajuste aplicado.\n");
  }
} catch (error) {
  process.stderr.write(`Não foi possível verificar o patch do ONNX Runtime: ${error.message}\n`);
  process.exitCode = 1;
}
