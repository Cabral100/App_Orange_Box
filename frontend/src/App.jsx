import { useCallback, useEffect, useState } from "react";
import CameraScreen from "./components/CameraScreen";
import MapScreen from "./components/MapScreen";
import RecordsScreen from "./components/RecordsScreen";
import ProfileScreen from "./components/ProfileScreen";
import LoginScreen from "./components/LoginScreen";
import { listDetections, listPlots } from "./lib/db";

const SESSION_KEY = "cyf.mock.session";
const LEGACY_SESSION_KEY = "orangebox.mock.session";

const mapTab = { id: "map", label: "Mapa", icon: "map" };
const cameraTab = { id: "camera", label: "Câmera", icon: "camera", primary: true };
const historyTab = { id: "records", label: "Histórico", icon: "book" };
const reportsTab = { id: "reports", label: "Relatórios", icon: "reports" };
const profileTab = { id: "profile", label: "Conta", icon: "profile" };
const inspectionTabs = [mapTab, cameraTab, historyTab, profileTab];
const adminTabs = [mapTab, historyTab, cameraTab, reportsTab, profileTab];

function NavIcon({ name }) {
  if (name === "map") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3.5 5.5 5-2.2 7 2.2 5-2.2v15.2l-5 2.2-7-2.2-5 2.2Z" />
        <path d="M8.5 3.3v15.2M15.5 5.5v15.2" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5h3l1.5-2h7l1.5 2h3v11H4Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7a2 2 0 0 1-2-2Z" />
        <path d="M5 17.5h13M8 8h7M8 11.5h7" />
      </svg>
    );
  }
  if (name === "reports") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v9l7.5 4.5A9 9 0 1 1 12 3.5Z" /><path d="M15.5 3.8v6.9l5.9 3.5a8.7 8.7 0 0 0-5.9-10.4Z" /></svg>;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" />
    </svg>
  );
}

function readSession() {
  try {
    return JSON.parse(
      sessionStorage.getItem(SESSION_KEY)
      || localStorage.getItem(SESSION_KEY)
      || localStorage.getItem(LEGACY_SESSION_KEY),
    ) || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [activeTab, setActiveTab] = useState(() => session?.role === "admin" ? "reports" : "camera");
  const [records, setRecords] = useState([]);
  const [plots, setPlots] = useState([]);
  const [toast, setToast] = useState(null);

  const refreshData = useCallback(async () => {
    const [nextRecords, nextPlots] = await Promise.all([listDetections(), listPlots()]);
    setRecords(nextRecords);
    setPlots(nextPlots);
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshData().catch(() => {
      setToast({ tone: "danger", message: "Não foi possível abrir o armazenamento local." });
    });
  }, [session, refreshData]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function login(account, { persistent = true } = {}) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    const storage = persistent ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(account));
    localStorage.removeItem(LEGACY_SESSION_KEY);
    setSession(account);
    setActiveTab(account.role === "admin" ? "reports" : "camera");
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    setSession(null);
    setActiveTab("camera");
  }

  if (!session) return <LoginScreen onLogin={login} />;
  const isAdmin = session.role === "admin";
  const availableTabs = isAdmin ? adminTabs : inspectionTabs;

  return (
    <div className={`mobile-app view-${activeTab}`}>
      <main className="screen-stack">
        {activeTab === "camera" && (
          <CameraScreen
            plots={plots}
            onOpenMap={() => setActiveTab("map")}
            onSaved={async () => {
              await refreshData();
            }}
          />
        )}
        {activeTab === "map" && (
          <MapScreen
            records={records}
            plots={plots}
            onPlotsChanged={refreshData}
            notify={setToast}
          />
        )}
        {(activeTab === "records" || (activeTab === "reports" && isAdmin)) && (
          <RecordsScreen
            key={activeTab}
            showReport={activeTab === "reports"}
            records={records}
            plots={plots}
            onChanged={refreshData}
            onOpenCamera={() => setActiveTab("camera")}
            notify={setToast}
          />
        )}
        {activeTab === "profile" && (
          <ProfileScreen session={session} records={records} plots={plots} onLogout={logout} />
        )}
      </main>

      <nav className={`bottom-nav${isAdmin ? " bottom-nav-admin" : ""}`} aria-label="Navegação principal">
        {availableTabs.map(({ id, label, icon, primary }) => (
          <button
            className={`nav-button ${activeTab === id ? "active" : ""} ${primary ? "nav-primary" : ""}`}
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            aria-label={label}
          >
            <span className="nav-icon"><NavIcon name={icon} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.tone || "success"}`} role="status">{toast.message}</div>}
    </div>
  );
}
