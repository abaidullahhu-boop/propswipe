import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [, navigate] = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/");
      return;
    }
    setIsAdmin(true);
  }, [navigate, isAuthenticated, isLoading, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAdmin]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  if (!isAdmin) {
    return null;
  }

  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <AdminSidebar onLogout={handleLogout} />
        <div className="flex min-h-0 flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
