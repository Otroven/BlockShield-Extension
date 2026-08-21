import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BlogProvider } from "./context/BlogContext";
import { WalletProvider } from "./context/WalletContext";
import "./styles.css";

function resetLocalStorageFromQuery() {
  const url = new URL(window.location.href);
  const shouldReset = url.searchParams.get("resetStorage") === "1";
  if (!shouldReset) return;

  const keysToDelete = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("blockshield:")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => window.localStorage.removeItem(key));

  url.searchParams.delete("resetStorage");
  window.history.replaceState({}, "", url.toString());
  window.alert("BlockShield 로컬 데이터가 초기화되었습니다.");
}

resetLocalStorageFromQuery();

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
