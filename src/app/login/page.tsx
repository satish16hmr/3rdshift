"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase"; // Import our configured Supabase client

export default function LoginPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        router.push("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          router.push("/dashboard");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]); // supabase client itself does not need to be in dependency array as it's static instance.

  if (session) {
    return <p>Redirecting to dashboard...</p>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          Sign In or Sign Up
        </h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={["google"]} // Add other providers if needed
          redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`}
        />
      </div>
    </div>
  );
}
