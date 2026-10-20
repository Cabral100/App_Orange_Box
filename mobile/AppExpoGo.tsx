import { AppShell } from "./src/AppShell";
import { analyzeDemo, prepareDemo } from "./src/demoModel";

export default function AppExpoGo() {
  return <AppShell analyzer={analyzeDemo} prepareAnalyzer={prepareDemo} demoMode />;
}
