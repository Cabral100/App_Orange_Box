import { useState } from "react";
import CyfLogo from "./CyfLogo";

const DEMO_ACCOUNT = {
  name: "Operador de campo",
  email: "operador@cyf.app",
  role: "Conta demonstrativa",
};

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const account = {
      name: String(values.get("name") || DEMO_ACCOUNT.name).trim(),
      email: String(values.get("email") || DEMO_ACCOUNT.email).trim(),
      role: "Conta demonstrativa",
    };
    if (mode === "create") {
      setCreated(account);
      return;
    }
    onLogin(account, { persistent: values.get("remember") === "on" });
  }

  if (created) {
    return (
      <main className="auth-screen auth-success">
        <section className="auth-shell">
          <CyfLogo />
          <div className="success-mark" aria-hidden="true">✓</div>
          <p className="overline">CONTA DEMONSTRATIVA</p>
          <h1>Tudo pronto.</h1>
          <p>Seu acesso local foi criado. Nenhum dado de conta foi enviado para um servidor.</p>
          <button className="primary-action" type="button" onClick={() => onLogin(created)}>Abrir o CYF</button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <section className="auth-shell">
        <header className="auth-brand">
          <CyfLogo />
          <p>Inspeção de citros com visão computacional e localização de campo.</p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === "create"} onClick={() => setMode("create")}>Criar conta</button>
        </div>

        <div className="auth-heading">
          <p className="overline">{mode === "login" ? "BEM-VINDO DE VOLTA" : "PRIMEIRO ACESSO"}</p>
          <h1>{mode === "login" ? "Acesse sua operação" : "Crie sua conta"}</h1>
          <p>{mode === "login" ? "Use os dados demonstrativos abaixo para entrar." : "Os dados abaixo ficam somente neste navegador."}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "create" && (
            <label>
              Nome completo
              <input name="name" type="text" defaultValue="Operador de campo" autoComplete="name" required />
            </label>
          )}
          <label>
            E-mail
            <input name="email" type="email" defaultValue={DEMO_ACCOUNT.email} autoComplete="username" required />
          </label>
          <label>
            Senha
            <div className="password-control">
              <input name="password" type={showPassword ? "text" : "password"} defaultValue="demo2026" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
            </div>
          </label>
          {mode === "login" && (
            <div className="auth-options">
              <label><input name="remember" type="checkbox" defaultChecked /> Manter acesso neste aparelho</label>
              <button type="button" onClick={() => window.alert("Recuperação de senha será conectada quando a autenticação real for configurada.")}>Esqueci a senha</button>
            </div>
          )}
          {mode === "create" && (
            <label className="consent-row">
              <input type="checkbox" required />
              <span>Li e concordo com o uso local dos dados deste protótipo.</span>
            </label>
          )}
          <button className="primary-action" type="submit">{mode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>

        {mode === "login" && (
          <>
            <div className="auth-divider"><span>ou</span></div>
            <button className="auth-provider" type="button" onClick={() => onLogin(DEMO_ACCOUNT, { persistent: true })}>
              <span aria-hidden="true">G</span> Continuar com Google — demonstração
            </button>
          </>
        )}

        <p className="auth-footnote">A autenticação é simulada. Fotos, coordenadas e talhões permanecem neste aparelho.</p>
      </section>
    </main>
  );
}
