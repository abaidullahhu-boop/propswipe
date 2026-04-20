import { Home, LayoutGrid, Upload, BarChart3, Settings, LogOut, Inbox, Flag, PlayCircle, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface AdminSidebarProps {
  onLogout: () => void;
}

const menuItems = [
  {
    title: "Public feed",
    url: "/",
    icon: PlayCircle,
    testId: "link-public-feed",
  },
  {
    title: "Dashboard",
    url: "/admin",
    icon: Home,
    testId: "link-dashboard",
  },
  {
    title: "Properties",
    url: "/admin/properties",
    icon: LayoutGrid,
    testId: "link-properties",
  },
  {
    title: "Leads",
    url: "/admin/leads",
    icon: Inbox,
    testId: "link-leads",
  },
  {
    title: "Reports",
    url: "/admin/reports",
    icon: Flag,
    testId: "link-reports",
  },
  {
    title: "Upload",
    url: "/admin/upload",
    icon: Upload,
    testId: "link-upload",
  },
  {
    title: "Mark Plot",
    url: "/plot-finder/v2",
    icon: MapPin,
    testId: "link-plot-finder",
  },
  {
    title: "Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
    testId: "link-analytics",
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    testId: "link-settings",
  },
];

export function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Home className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black">PropSwipe</h2>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId} className={`${location === item.url ? "bg-primary/40 text-primary border-primary/10 border-2" : "text-muted-foreground"}`}>
                      <item.icon className={`w-5 h-5 ${location === item.url ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`${location === item.url ? "text-primary" : "text-muted-foreground"}`}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          data-testid="button-logout"
          onClick={onLogout}
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
