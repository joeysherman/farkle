import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import React from 'react';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    // Initial auth check
    void checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated !== null && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-sm text-center">
          {isAuthenticated ? 'You are signed in' : 'You are not signed in'}
        </div>
      )}
      <Outlet />
    </div>
  );
} 