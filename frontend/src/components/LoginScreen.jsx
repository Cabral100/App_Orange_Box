import { useEffect, useRef, useState } from "react";
import googleIcon from "../../../mobile/assets/google-g.png";
import CyfLogo from "./CyfLogo";

const accounts = {
  inspection: { name: "Operador de campo", email: "operador@cyf.app", password: "demo2026", title: "Inspeção", description: "Câmera, mapa e histórico" },
  admin: { name: "Fernanda Almeida", email: "admin@cyf.app", password: "admin123", title: "Administrador", description: "Operação e relatórios" },
};

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState("welcome");
  const [role, setRole] = useState("inspection");
  const [email, setEmail] = useState(accounts.inspection.email);
  const [password, setPassword] = useState(accounts.inspection.password);
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState("");
  const title = useRef(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    title.current?.focus();
  }, [step]);

  function navigate(next) {
    if (next === "create") setPassword("");
    if (step === "create" && next === "login") chooseRole(role);
    setReveal(false);
    setMessage("");
    setStep(next);
  }

  function chooseRole(next) {
    setRole(next);
    setEmail(accounts[next].email);
    setPassword(accounts[next].password);
    setMessage("");
  }

  function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (step === "create") {
      const name = String(values.get("name")).trim();
      if (!name || password !== values.get("confirmation")) {
        setMessage(!name ? "Informe seu nome completo." : "As senhas precisam ser iguais.");
        return;
      }
      onLogin({ name, email: String(values.get("email")).trim(), role: "inspection" });
      return;
    }
    const account = accounts[role];
    if (role === "admin" && (email.trim().toLowerCase() !== account.email || password !== account.password)) {
      setMessage("E-mail ou senha incorretos. Use a conta de teste para preencher os dados.");
      return;
    }
    onLogin({ name: account.name, email: email.trim(), role }, { persistent: values.has("remember") });
  }

  const welcome = step === "welcome";
  const creating = step === "create";
  return (
    <main className="auth-screen">
      <section className={`auth-shell auth-${step}`} aria-labelledby="auth-title">
        <header className="auth-hero">
          <img src="/citrus-cover.jpg" alt="" />
          <div className="auth-hero-top">
            <CyfLogo compact inverse />
            {!welcome && <button className="auth-back" type="button" onClick={() => navigate(creating ? "login" : "welcome")} aria-label="Voltar">←</button>}
          </div>
          <div className="auth-hero-copy">
            <span>MONITORAMENTO DE CITROS</span>
            <p>{creating ? "Sua primeira vistoria começa aqui." : "Uma visão mais clara do seu pomar."}</p>
          </div>
        </header>

        <div className="auth-panel">
          {welcome ? <>
            <h1 id="auth-title" ref={title} tabIndex={-1}>Do pomar ao relatório</h1>
            <p>Registre vistorias, localize ocorrências no mapa e acompanhe as mudanças em cada talhão.</p>
            <button className="primary-action" type="button" onClick={() => navigate("login")}>Começar <span aria-hidden="true">→</span></button>
            <button className="auth-link" type="button" onClick={() => navigate("create")}>Criar conta de teste</button>
          </> : <>
            <h1 id="auth-title" ref={title} tabIndex={-1}>{creating ? "Criar conta" : "Acesso ao campo"}</h1>
            <p>{creating ? "Crie um acesso local de Inspeção para experimentar o CYF." : "Escolha seu perfil. Os dados de teste são preenchidos automaticamente."}</p>
            <form key={step} className="auth-form" onSubmit={submit}>
              {creating ? <>
                <label>Nome completo<input name="name" autoComplete="name" required /></label>
                <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
              </> : <>
                <fieldset className="auth-roles">
                  <legend>Como você vai usar o app?</legend>
                  {Object.entries(accounts).map(([id, account]) => (
                    <label key={id}>
                      <input type="radio" name="role" checked={role === id} onChange={() => chooseRole(id)} />
                      <span><strong>{account.title}</strong><small>{account.description}</small></span>
                    </label>
                  ))}
                </fieldset>
                <label>E-mail<input name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              </>}
              <label htmlFor="access-password">Senha</label>
              <div className="password-control">
                <input id="access-password" name="password" type={reveal ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete={creating ? "new-password" : "current-password"} required />
                <button type="button" aria-controls="access-password" onClick={() => setReveal(!reveal)}>{reveal ? "Ocultar" : "Mostrar"}</button>
              </div>
              {creating ? <>
                <label>Confirmar senha<input name="confirmation" type={reveal ? "text" : "password"} autoComplete="new-password" minLength={6} required /></label>
                <label className="auth-check"><input type="checkbox" required /> Concordo com o uso local dos dados neste protótipo.</label>
              </> :
                <div className="auth-options">
                  <label className="auth-check"><input name="remember" type="checkbox" defaultChecked /> Manter acesso neste aparelho</label>
                  <button className="auth-link" type="button" onClick={() => chooseRole(role)}>Usar conta de teste</button>
                  <button className="auth-link" type="button" onClick={() => setMessage("A recuperação de senha estará disponível quando a autenticação real for configurada.")}>Esqueci a senha</button>
                </div>
              }
              {message && <p className="auth-error" role="alert">{message}</p>}
              <button className="primary-action" type="submit">{creating ? "Criar acesso local" : `Entrar como ${accounts[role].title.toLowerCase()}`} <span aria-hidden="true">→</span></button>
              {!creating && (
                <button className="auth-provider" type="button" onClick={(event) => {
                  const { name, email } = accounts[role];
                  onLogin({ name, email, role }, { persistent: event.currentTarget.form.elements.remember.checked });
                }}>
                  <img src={googleIcon} alt="" />
                  <span>Entrar com Google<small>Demonstração</small></span>
                </button>
              )}
            </form>
            <button className="auth-link" type="button" onClick={() => navigate(creating ? "login" : "create")}>
              {creating ? "Já tenho conta de teste" : "Criar conta de teste"}
            </button>
            <p className="auth-footnote">Acesso demonstrativo. Os dados ficam neste aparelho.</p>
          </>}
        </div>
      </section>
    </main>
  );
}
