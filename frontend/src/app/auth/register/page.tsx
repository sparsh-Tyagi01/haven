"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";

export default function RegisterPage() {
  const { register, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (username.length < 3 || username.length > 30) {
      setError("Username must be between 3 and 30 characters.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register(username, email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
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
            <h2 style={styles.essayTitle}>On Community-First Integrity</h2>
            <p style={styles.essayText}>
              By establishing your Haven identity, you become a citizen of focused, self-moderated collectives. 
            </p>
            <p style={styles.essayText}>
              Your display name and credentials will represent your status. Reputation is community-specific, earned
              through active, helpful verification of knowledge, roadmap updates, and constructive feedback.
            </p>
            <div style={styles.divider}></div>
            <span style={styles.dateStamp}>Decentralized & Encrypted Session Protocol</span>
          </div>

          {/* Right Column: High-Fidelity Register Form */}
          <div style={styles.formCol}>
            <h2 style={styles.formTitle}>Join the Haven</h2>
            <p style={styles.formSub}>Create a new citizenship in the network.</p>

            {error && (
              <div style={styles.errorAlert}>
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  placeholder="e.g. alex_smith"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  disabled={isSubmitting}
                  required
                />
              </div>

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
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-type password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {isSubmitting ? "Creating citizenship..." : "Establish Account"}
              </button>
            </form>

            <div style={styles.footerLinks}>
              <span>Already a member? </span>
              <Link href="/auth/login" style={styles.link}>
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reuse gorgeous editorial styling
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
