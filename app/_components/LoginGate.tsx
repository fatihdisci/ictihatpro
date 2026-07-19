"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "./Icons";
import { spring } from "../_lib/motion";

export function LoginGate({
  configured,
  onAuthenticated,
}: {
  configured: boolean;
  onAuthenticated: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!password || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPassword("");
        onAuthenticated();
      } else {
        setError(data.error || "Giriş yapılamadı");
      }
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate" id="main-content">
      <motion.section
        className="gate-panel"
        initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...spring.glide, filter: { duration: 0.3 } }}
      >
        <a className="wordmark" href="/" aria-label="İçtihat Asistanı">
          <span className="wordmark-glyph">İA</span>
          <span className="wordmark-text">
            <b>İçtihat Asistanı</b>
            <span>Hukuk araştırması</span>
          </span>
        </a>

        <h1>Oturum</h1>
        <p className="gate-lede">Devam etmek için erişim parolanızı girin.</p>

        {!configured && (
          <div className="notice notice-warn" style={{ marginBottom: "1rem" }}>
            Sunucu yapılandırması eksik. <code>APP_PASSWORD</code> ve <code>SESSION_SECRET</code> değerlerini ekleyin.
          </div>
        )}

        <div className="field">
          <label htmlFor="password">Erişim parolası</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && login()}
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {error && (
          <motion.p
            className="notice notice-error"
            role="alert"
            style={{ marginTop: "0.75rem" }}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [-6, 5, -3, 0] }}
            transition={{ duration: 0.32 }}
          >
            {error}
          </motion.p>
        )}

        <motion.button
          className="btn btn-primary btn-block"
          style={{ marginTop: "1rem" }}
          onClick={login}
          disabled={!password || busy}
          whileTap={{ scale: 0.98 }}
          transition={spring.snap}
        >
          {busy ? "Doğrulanıyor…" : "Giriş yap"}
          <ArrowUpRight />
        </motion.button>

        <p className="gate-note">
          <span className="pip" aria-hidden="true" />
          API anahtarı tarayıcıya gönderilmez
        </p>
      </motion.section>
    </main>
  );
}
