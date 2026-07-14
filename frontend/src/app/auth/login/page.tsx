"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to home page
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push("/");
    }
  }, [isAuthenticated, loading, router]);

  if (isAuthenticated && !loading) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        <div style={styles.brandSection}>
          <h1 style={styles.brandTitle}>THE HAVEN</h1>
          <p style={styles.brandSub}>No. 1 — A Noise-Free Knowledge Network</p>
        </div>

        <div style={styles.gridContainer}>
          {/* Left Column: Philosophical Editorial Context */}
          <div style={styles.editorialCol}>
            <h2 style={styles.essayTitle}>On Collaborative Memory</h2>
            <p style={styles.essayText}>
              Haven is established on the belief that human knowledge should be organized cooperatively, rather than
              distributed via individual engagement-bait algorithms.
            </p>
            <p style={styles.essayText}>
              By connecting inside focused communities (servers), members compile a permanent searchable wiki, maintain
              transparent project progress, and interact in real-time without outrage feeds.
            </p>
            <div style={styles.divider}></div>
            <span style={styles.dateStamp}>Est. 2026 — Verified Decentralized Workspace</span>
          </div>

          {/* Right Column: High-Fidelity Login Form */}
          <div style={styles.formCol}>
            <h2 style={styles.formTitle}>Sign In</h2>
            <p style={styles.formSub}>Welcome back. Please input your credentials below.</p>

            {error && (
              <div style={styles.errorAlert}>
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Authenticating..." : "Access Account"}
              </button>
            </form>

            <div style={styles.footerLinks}>
              <span>New to Haven? </span>
              <Link href="/auth/register" style={styles.link}>
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline styles for extreme editorial high-fidelity aesthetics
const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1.5rem",
    backgroundColor: "var(--bg-main)",
  },
  editorialFrame: {
    width: "100%",
    maxWidth: "960px",
    backgroundColor: "var(--bg-surface)",
    border: "2px solid var(--text-main)",
    padding: "2.5rem",
    boxShadow: "var(--shadow-lg)",
    position: "relative",
  },
  brandSection: {
    textAlign: "center",
    borderBottom: "1px double var(--text-main)",
    paddingBottom: "1.5rem",
    marginBottom: "2.5rem",
  },
  brandTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "3.5rem",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    textTransform: "uppercase",
    border: "none",
    padding: 0,
    margin: 0,
    lineHeight: 1,
  },
  brandSub: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.8rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "var(--text-muted)",
    marginTop: "0.5rem",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "3rem",
  },
  editorialCol: {
    borderRight: "1px solid var(--border-color)",
    paddingRight: "2.5rem",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  essayTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.5rem",
    fontWeight: 600,
    fontStyle: "italic",
    marginBottom: "1.25rem",
    color: "var(--text-main)",
  },
  essayText: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.92rem",
    color: "var(--text-muted)",
    lineHeight: 1.7,
    marginBottom: "1rem",
  },
  divider: {
    height: "1px",
    backgroundColor: "var(--border-color)",
    margin: "1.5rem 0",
  },
  dateStamp: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--text-light)",
    textTransform: "uppercase",
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  formTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "2rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
  },
  formSub: {
    fontSize: "0.95rem",
    color: "var(--text-muted)",
    marginBottom: "2rem",
  },
  errorAlert: {
    backgroundColor: "rgba(168, 61, 49, 0.08)",
    borderLeft: "3px solid var(--error)",
    padding: "0.75rem 1rem",
    marginBottom: "1.5rem",
  },
  errorText: {
    fontSize: "0.85rem",
    color: "var(--error)",
    fontWeight: 500,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  submitBtn: {
    width: "100%",
    padding: "1rem",
    marginTop: "0.5rem",
  },
  footerLinks: {
    marginTop: "1.5rem",
    textAlign: "center",
    fontSize: "0.9rem",
    color: "var(--text-muted)",
  },
  link: {
    fontWeight: 600,
    textDecoration: "underline",
  },
};
