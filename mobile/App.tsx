import { AppShell } from "./src/AppShell";
import { analyzeOffline, loadOfflineModel } from "./src/offlineModel";

export default function App() {
  return <AppShell analyzer={analyzeOffline} prepareAnalyzer={loadOfflineModel} />;
}
