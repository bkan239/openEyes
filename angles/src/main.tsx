import React from "react";
import ReactDOM from "react-dom/client";
import { ShowcaseEvent } from "@/components/Showcase/ShowcaseEvent";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ShowcaseEvent />
  </React.StrictMode>
);
