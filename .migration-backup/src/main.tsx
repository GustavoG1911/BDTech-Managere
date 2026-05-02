console.log("[Main] Iniciando renderização do App");
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
  console.log("[Main] Root renderizado com sucesso");
} else {
  console.error("[Main] Erro fatal: Elemento 'root' não encontrado no DOM!");
}
