import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "./index.css";
import { CoreApp } from "./modules/core";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider>
      <CoreApp />
    </MantineProvider>
  </StrictMode>,
);
