import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BlogProvider } from "./context/BlogContext";
import { WalletProvider } from "./context/WalletContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <BlogProvider>
          <App />
        </BlogProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
