import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../App";
import "../ui/tokens.css";
import "../ui/components.css";
import "./app.css";
import { installDevWallet } from "../devWallet";

installDevWallet();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
