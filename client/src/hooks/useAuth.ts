import { useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail');
    setUser(null);
    // Force refresh to update auth state
    window.location.href = '/';
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout
  };
}