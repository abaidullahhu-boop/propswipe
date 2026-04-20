import { Home, Eye, Heart, TrendingUp, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property, SavedProperty } from "@shared/schema";
import { useGetPropertiesQuery, useGetAllSavedPropertiesQuery, useGetLeadsQuery } from "@/store/api/apiSlice";

export default function AdminDashboard() {
  const { data: properties = [], isLoading } = useGetPropertiesQuery();
  const { data: savedProperties = [] } = useGetAllSavedPropertiesQuery();
  const { data: leads = [] } = useGetLeadsQuery();

  const totalProperties = properties.length;
  const activeProperties = properties.filter((p) => p.status === "active").length;
  const totalViews = properties.reduce((sum, p) => sum + p.views, 0);
  const totalSaved = savedProperties.length;
  const totalLeads = leads.length;

  const stats = [
    {
      title: "Total Properties",
      value: totalProperties,
      icon: Home,
      description: `${activeProperties} active`,
      testId: "card-total-properties",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      title: "Total Views",
      value: totalViews.toLocaleString(),
      icon: Eye,
      description: "Across all properties",
      testId: "card-total-views",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
    },
    {
      title: "Saved Properties",
      value: totalSaved,
      icon: Heart,
      description: "By all users",
      testId: "card-saved-properties",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-500",
    },
    {
      title: "Active Listings",
      value: activeProperties,
      icon: TrendingUp,
      description: "Currently live",
      testId: "card-active-listings",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
    },
    {
      title: "Total Leads",
      value: totalLeads,
      icon: Inbox,
      description: "Contact requests",
      testId: "card-total-leads",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your property listings</p>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading dashboard...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {stats.map((stat) => (
              <Card key={stat.title} data-testid={stat.testId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {properties.slice(0, 5).map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between p-4 rounded-lg hover-elevate"
                    data-testid={`activity-${property.id}`}
                  >
                    <div>
                      <p className="font-semibold">{property.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.city}, {property.state}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">
                        ${parseFloat(property.price).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{property.views} views</p>
                    </div>
                  </div>
                ))}
                {properties.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No properties yet. Upload your first property to get started!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}