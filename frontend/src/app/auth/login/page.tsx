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
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brandSection}>
          <Link href="/" style={styles.brandLink}>
            <span style={styles.brandIcon}>H</span>
          </Link>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to your Haven account</p>
        </div>

        {/* Grid */}
        <div style={styles.gridContainer}>
          {/* Left: Editorial context */}
          <div style={styles.editorialCol}>
            <h2 style={styles.editorialTitle}>
              Knowledge thrives in community
            </h2>
            <p style={styles.editorialText}>
              Haven organizes knowledge around communities, not algorithms.
              Every discussion contributes to a growing, permanent wiki that
              makes your communities smarter over time.
            </p>
            <div style={styles.divider} />
            <span style={styles.stamp}>Est. 2026 — Haven Network</span>
          </div>

          {/* Right: Login form */}
          <div style={styles.formCol}>
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
                  placeholder="name@example.com"
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
                className="btn btn-primary btn-lg"
                style={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
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

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1.5rem",
    backgroundColor: "var(--bg-primary)",
  },
  card: {
    width: "100%",
    maxWidth: "880px",
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-lg)",
    padding: "2.5rem",
    boxShadow: "var(--shadow-lg)",
  },
  brandSection: {
    textAlign: "center",
    marginBottom: "2.5rem",
  },
  brandLink: {
    display: "inline-block",
    textDecoration: "none",
    marginBottom: "1.25rem",
  },
  brandIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "var(--text-xl)",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: "0.35rem",
    border: "none",
  },
  subtitle: {
    fontSize: "var(--text-base)",
    color: "var(--text-tertiary)",
    margin: 0,
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "2.5rem",
  },
  editorialCol: {
    borderRight: "1px solid var(--border-primary)",
    paddingRight: "2.5rem",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  editorialTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-xl)",
    fontWeight: 600,
    fontStyle: "italic",
    marginBottom: "1rem",
    color: "var(--text-primary)",
  },
  editorialText: {
    fontSize: "var(--text-base)",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    margin: 0,
  },
  divider: {
    height: "1px",
    backgroundColor: "var(--border-primary)",
    margin: "1.5rem 0",
  },
  stamp: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  errorAlert: {
    backgroundColor: "var(--color-error-light)",
    borderLeft: "3px solid var(--color-error)",
    padding: "0.65rem 1rem",
    marginBottom: "1.25rem",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
  },
  errorText: {
    fontSize: "var(--text-sm)",
    color: "var(--color-error)",
    fontWeight: 500,
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  submitBtn: {
    width: "100%",
    marginTop: "0.5rem",
  },
  footerLinks: {
    marginTop: "1.5rem",
    textAlign: "center",
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
  },
  link: {
    fontWeight: 600,
    color: "var(--color-primary)",
    textDecoration: "underline",
  },
};
