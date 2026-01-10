import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 overflow-auto pb-24 lg:pb-0">
        <div className="min-h-full gradient-background">
          <Outlet />
        </div>
      </main>
      
      <MobileNav />
    </div>
  );
}
