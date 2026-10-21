import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Site } from "./Site";
import "../ui/tokens.css";
import "../ui/components.css";
import "./site.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
