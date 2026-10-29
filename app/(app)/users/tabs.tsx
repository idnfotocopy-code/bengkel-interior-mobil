import { Tabs } from '@/components/ui';
export function UserTabs({ active }: { active: 'users' | 'roles' | 'log' }) {
  return <Tabs active={active} items={[
    { key: 'users', label: '👥 Daftar pengguna', href: '/users' },
    { key: 'roles', label: '🛡️ Role & hak akses', href: '/users/roles' },
    { key: 'log', label: '🕑 Log aktivitas', href: '/users/log' },
  ]} />;
}
