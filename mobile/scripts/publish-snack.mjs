import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

async function readExpoUser() {
  const userProfile = process.env.USERPROFILE;
  if (!userProfile) {
    throw new Error("USERPROFILE nao esta disponivel para localizar a sessao Expo.");
  }

  const statePath = path.join(userProfile, ".expo", "state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const sessionSecret = state?.auth?.sessionSecret;

  if (!sessionSecret) {
    throw new Error("Nenhuma sessao Expo ativa foi encontrada. Execute `npx expo login` e tente novamente.");
  }

  return { sessionSecret };
}

async function collectCodeFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = {};

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await collectCodeFiles(relativePath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && entry.name !== "offlineModel.ts") {
      files[relativePath] = {
        type: "CODE",
        // O runtime do Snack pode repetir a primeira linha durante hot update.
        // Uma sentinela inofensiva impede que uma declaracao import seja repetida.
        contents: `// CYF Snack runtime guard\n${await readFile(path.join(root, relativePath), "utf8")}`,
      };
    }
  }

  return files;
}

const appContents = await readFile(path.join(root, "AppExpoGo.tsx"), "utf8");
const googleLogo = await readFile(path.join(root, "assets", "google-g.png"));
const assetForm = new FormData();
assetForm.append("asset", new Blob([googleLogo], { type: "image/png" }), "google-g.png");
const assetResponse = await fetch("https://exp.host/--/api/v2/snack/uploadAsset", {
  method: "POST",
  body: assetForm,
});
if (!assetResponse.ok) throw new Error(`Falha ao enviar o logo: ${await assetResponse.text()}`);
const { url: googleLogoUrl } = await assetResponse.json();

const files = {
  "App.tsx": { type: "CODE", contents: `// CYF Snack runtime guard\n${appContents}` },
  "assets/google-g.png": { type: "ASSET", contents: googleLogoUrl },
  ...(await collectCodeFiles("src")),
};

const dependencies = {
  "@expo-google-fonts/inter": { version: "^0.4.2" },
  "@expo/vector-icons": { version: "^15.0.3" },
  "@react-native-async-storage/async-storage": { version: "2.2.0" },
  "expo-camera": { version: "~57.0.6" },
  "expo-document-picker": { version: "~57.0.3" },
  "expo-file-system": { version: "~57.0.7" },
  "expo-font": { version: "~57.0.4" },
  "expo-image-manipulator": { version: "~57.0.21" },
  "expo-image-picker": { version: "~57.0.20" },
  "expo-location": { version: "~57.0.21" },
  "expo-print": { version: "~57.0.2" },
  "expo-sharing": { version: "~57.0.23" },
  "expo-status-bar": { version: "~57.0.1" },
  "react-native-maps": { version: "1.27.2" },
  "react-native-safe-area-context": { version: "~5.7.0" },
};

const user = await readExpoUser();
const sdkVersion = "57.0.0";
const savedResponse = await fetch("https://exp.host/--/api/v2/snack/save", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Expo-Session": user.sessionSecret },
  body: JSON.stringify({
    manifest: {
      sdkVersion,
      name: "CYF — Clean Your Farm",
      description: "Demonstração mobile offline-first para inspeção de citros. O reconhecimento é simulado nesta versão Expo Go.",
      dependencies: Object.fromEntries(Object.entries(dependencies).map(([name, value]) => [name, value.version])),
    },
    code: files,
    dependencies,
    isDraft: false,
  }),
});
const saved = await savedResponse.json();
if (!savedResponse.ok || !saved.id) {
  throw new Error(saved?.errors?.[0]?.message || `Falha ao salvar o Snack (${savedResponse.status}).`);
}
const runtimeUrl = `exp://u.expo.dev/933fd9c0-1666-11e7-afca-d980795c5824?runtime-version=exposdk%3A57.0.0&channel-name=production&snack=${encodeURIComponent(saved.id)}`;
console.log(JSON.stringify({
  id: saved.id,
  snackId: saved.snackId,
  accountSnackId: saved.accountSnackId,
  url: runtimeUrl,
}, null, 2));
