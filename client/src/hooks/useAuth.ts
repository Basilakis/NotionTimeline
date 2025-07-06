import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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

  // Get user email from localStorage
  const userEmail = localStorage.getItem('userEmail');

  // Fetch user details from backend
  const { data: fetchedUser, isLoading: isFetching } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    enabled: !!userEmail && !user, // Only fetch if we have email but no user data
    retry: false,
    meta: {
      headers: {
        'x-user-email': userEmail || ''
      }
    }
  });

  useEffect(() => {
    // First check localStorage for existing user
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsLoading(false);
        return;
      } catch (error) {
        localStorage.removeItem('user');
      }
    }

    // If we fetched user from backend, store it
    if (fetchedUser) {
      localStorage.setItem('user', JSON.stringify(fetchedUser));
      setUser(fetchedUser);
    }

    setIsLoading(isFetching);
  }, [fetchedUser, isFetching]);

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