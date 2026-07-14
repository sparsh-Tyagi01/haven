"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import { request, APIError } from "../lib/api";

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  website: string;
  skills: string[];
  reputation: number;
  privacy: string;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (typeof window === "undefined") return;

      const accessToken = localStorage.getItem("haven_access_token");
      const refreshToken = localStorage.getItem("haven_refresh_token");

      if (!accessToken || !refreshToken) {
        setLoading(false);
        return;
      }

      try {
        // Try decoding JWT to read payload, or do a light check profile call
        // For security & sanity, we load current user from backend using a profile get
        // To do that, we get username from stored user metadata or load it directly
        const storedUser = localStorage.getItem("haven_user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          // Verify access token is still active by requesting profile
          const profile = await request(`/users/profile/${parsed.username}`, {
            token: accessToken,
          });
          // Update profile if server matches
          setUser({ ...profile, email: parsed.email });
        }
      } catch (err) {
        // Access token might be expired. Try using refresh token.
        try {
          const res = await request("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          localStorage.setItem("haven_access_token", res.access_token);
          localStorage.setItem("haven_refresh_token", res.refresh_token);
          localStorage.setItem("haven_user", JSON.stringify(res.user));
          setUser(res.user);
        } catch (refreshErr) {
          // Both tokens invalid, clear authentication
          localStorage.removeItem("haven_access_token");
          localStorage.removeItem("haven_refresh_token");
          localStorage.removeItem("haven_user");
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("haven_access_token", res.access_token);
      localStorage.setItem("haven_refresh_token", res.refresh_token);
      localStorage.setItem("haven_user", JSON.stringify(res.user));
      setUser(res.user);
    } catch (err) {
      throw err;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const res = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });

      localStorage.setItem("haven_access_token", res.access_token);
      localStorage.setItem("haven_refresh_token", res.refresh_token);
      localStorage.setItem("haven_user", JSON.stringify(res.user));
      setUser(res.user);
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    const accessToken = localStorage.getItem("haven_access_token");
    try {
      if (accessToken) {
        await request("/auth/logout", {
          method: "POST",
          token: accessToken,
        });
      }
    } catch (err) {
      console.error("failed to log out from server, clearing local session...", err);
    } finally {
      localStorage.removeItem("haven_access_token");
      localStorage.removeItem("haven_refresh_token");
      localStorage.removeItem("haven_user");
      setUser(null);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const accessToken = localStorage.getItem("haven_access_token");
    if (!accessToken) throw new Error("unauthenticated");

    try {
      const updatedUser = await request("/users/profile", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify(data),
      });

      localStorage.setItem("haven_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
