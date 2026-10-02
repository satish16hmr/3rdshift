'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email ?? null);
      }
    };
    checkUser();
  }, [router]);

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-inter">
        <p className="text-gray-700">Loading...</p>
      </div>
    );
  }

  const statCards = [
    { title: 'AI Workers', value: '40' },
    { title: 'Tasks Run', value: '0' },
    { title: 'Plan', value: 'Starter Plan' },
  ];

  return (
    <div className="min-h-screen bg-white font-inter text-gray-900 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back, {userEmail}</h1>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-lg shadow-md"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-gray-500 text-sm mb-1">{card.title}</p>
            <p className="text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-12">
        <button
          onClick={() => router.push('/workers')}
          className="bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition duration-200"
        >
          Browse Workers
        </button>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Tasks</h2>
        <div
          className="bg-white p-6 rounded-lg shadow-md flex items-center justify-center h-32"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <p className="text-gray-500 italic">No tasks yet. Submit your first task!</p>
        </div>
      </section>
    </div>
  );
}
