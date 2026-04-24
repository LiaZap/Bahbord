'use client';

import { useEffect, useState } from 'react';
import ViewTabs from './ViewTabs';

export default function ViewTabsWrapper() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      const role = data?.member?.role;
      setIsAdmin(role === 'owner' || role === 'admin');
    }).catch(() => {});
  }, []);

  return <ViewTabs isAdmin={isAdmin} />;
}
