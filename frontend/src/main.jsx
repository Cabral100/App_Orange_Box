import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
