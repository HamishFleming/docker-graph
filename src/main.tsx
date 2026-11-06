import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import WorkerGraph from "./WorkerGraph";
import "reactflow/dist/style.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname === "/worker-render" ? <WorkerGraph /> : <App />}
  </React.StrictMode>
);
