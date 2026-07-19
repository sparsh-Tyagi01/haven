"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  if (loading) return null;

  return (
    <nav className={styles.navbar}>
      <div className={styles.navInner}>
        {/* Brand */}
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>H</span>
          <span className={styles.brandName}>Haven</span>
        </Link>

        {/* Center Navigation */}
        <div className={styles.navLinks}>
          <Link
            href="/"
            className={`${styles.navLink} ${isActive("/") && pathname === "/" ? styles.navLinkActive : ""}`}
          >
            <span className={styles.navLinkIcon}>◉</span>
            Home
          </Link>
          <Link
            href="/communities"
            className={`${styles.navLink} ${isActive("/communities") ? styles.navLinkActive : ""}`}
          >
            <span className={styles.navLinkIcon}>⬡</span>
            Communities
          </Link>
          {isAuthenticated && (
            <Link
              href="/messages"
              className={`${styles.navLink} ${isActive("/messages") ? styles.navLinkActive : ""}`}
            >
              <span className={styles.navLinkIcon}>✉</span>
              Messages
            </Link>
          )}
        </div>

        {/* Right Section */}
        <div className={styles.navRight}>
          {isAuthenticated && user ? (
            <div className={styles.userMenu} ref={dropdownRef}>
              <button
                className={styles.userTrigger}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="User menu"
              >
                <span className={styles.userAvatar}>
                  {user.display_name?.charAt(0).toUpperCase() ||
                    user.username.charAt(0).toUpperCase()}
                </span>
                <span className={styles.userName}>
                  {user.display_name || user.username}
                </span>
                <span
                  className={`${styles.userChevron} ${dropdownOpen ? styles.userChevronOpen : ""}`}
                >
                  ▾
                </span>
              </button>

              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownDisplayName}>
                      {user.display_name}
                    </div>
                    <div className={styles.dropdownUsername}>
                      @{user.username}
                    </div>
                  </div>
                  <Link href="/messages" className={styles.dropdownItem}>
                    ✉ Messages
                  </Link>
                  <div className={styles.dropdownDivider} />
                  <button
                    onClick={handleLogout}
                    className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authLinks}>
              <Link href="/auth/login" className={styles.signInLink}>
                Sign In
              </Link>
              <Link href="/auth/register" className="btn btn-primary btn-sm">
                Join Haven
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
