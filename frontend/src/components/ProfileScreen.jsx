import { useEffect, useMemo, useState } from "react";
import { getHealth } from "../lib/api";
import { pestCount } from "../lib/analytics";
import CyfLogo from "./CyfLogo";

function initials(name) {
  return String(name || "CYF")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ProfileScreen({ session, records, plots, onLogout }) {
  const [health, setHealth] = useState({ state: "loading", data: null });
  const pests = useMemo(() => records.reduce((sum, record) => sum + pestCount(record), 0), [records]);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((data) => setHealth({ state: data.status === "ok" ? "ready" : "error", data }))
      .catch(() => setHealth({ state: "error", data: null }));
    return () => controller.abort();
  }, []);

  const analysisCopy = health.state === "loading"
    ? "Verificando a conexão…"
    : health.state === "ready"
      ? "Pronta para analisar novas imagens"
      : "Indisponível; inicie o serviço no computador";

  return (
    <section className="profile-screen content-screen">
      <header className="profile-hero">
        <CyfLogo inverse />
        <div className="profile-person">
          <span className="profile-avatar">{initials(session.name)}</span>
          <div>
            <p>Conta de campo</p>
            <h1>{session.name}</h1>
            <span>{session.email}</span>
          </div>
        </div>
        <div className="profile-stats" aria-label="Resumo dos dados locais">
          <div><strong>{plots.length}</strong><span>talhões</span></div>
          <div><strong>{records.length}</strong><span>fotos</span></div>
          <div><strong>{pests}</strong><span>pragas</span></div>
        </div>
      </header>

      <div className="profile-body">
        <p className="section-kicker">OPERAÇÃO NESTE APARELHO</p>
        <section className="plain-card status-list">
          <div>
            <span><strong>Análise da câmera</strong><small>{analysisCopy}</small></span>
            <b className={`status-pill ${health.state}`}>{health.state === "ready" ? "ATIVA" : health.state === "loading" ? "VERIFICANDO" : "OFFLINE"}</b>
          </div>
          <div>
            <span><strong>Salvamento automático</strong><small>Ativado para inspeções confirmadas pela câmera</small></span>
            <b className="status-pill neutral">ATIVO</b>
          </div>
          <div>
            <span><strong>Armazenamento</strong><small>Fotos, talhões e relatórios ficam no navegador</small></span>
            <b className="status-pill neutral">LOCAL</b>
          </div>
        </section>

        <p className="section-kicker">TRANSPARÊNCIA</p>
        <section className="plain-card transparency-card">
          <strong>O que este protótipo faz</strong>
          <p>Ele registra uma triagem experimental, o resultado da análise e a posição informada pelo aparelho ou pelo EXIF. Não substitui confirmação agronômica.</p>
          <p>Próximo a divisas, a precisão do GPS pode associar a foto ao talhão errado. O registro permite correção manual.</p>
        </section>

        <button className="outline-danger" type="button" onClick={onLogout}>Sair da conta demonstrativa</button>
        <p className="app-version">CYF · Clean Your Farm · protótipo acadêmico</p>
      </div>
    </section>
  );
}
