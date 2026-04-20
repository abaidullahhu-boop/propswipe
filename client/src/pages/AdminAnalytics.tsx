import { useMemo } from "react";
import { Eye, Heart, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGetPropertiesQuery,
  useGetAllSavedPropertiesQuery,
  useGetLeadsQuery,
  useGetAnalyticsSummaryQuery,
} from "@/store/api/apiSlice";

export default function AdminAnalytics() {
  const { data: properties = [] } = useGetPropertiesQuery();
  const { data: savedProperties = [] } = useGetAllSavedPropertiesQuery();
  const { data: leads = [] } = useGetLeadsQuery();
  const { data: analyticsSummary, isLoading } = useGetAnalyticsSummaryQuery();

  const savesByProperty = useMemo(() => {
    const map = new Map<string, number>();
    savedProperties.forEach((saved) => {
      map.set(saved.propertyId, (map.get(saved.propertyId) || 0) + 1);
    });
    return map;
  }, [savedProperties]);

  const topByViews = useMemo(() => {
    return [...properties].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  }, [properties]);

  const topBySaves = useMemo(() => {
    return [...properties]
      .sort((a, b) => (savesByProperty.get(b.id) || 0) - (savesByProperty.get(a.id) || 0))
      .slice(0, 5);
  }, [properties, savesByProperty]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2">Analytics</h1>
        <p className="text-muted-foreground">Performance overview</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading analytics...</span>
          </div>
        </div>
      ) : (
        <>


          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Eye className="w-4 h-4 text-violet-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">
                  {properties.reduce((sum, p) => sum + (p.views ?? 0), 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Saves</CardTitle>
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">{savedProperties.length.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Inbox className="w-4 h-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">{leads.length.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Watch Time</CardTitle>
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Eye className="w-4 h-4 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">
                  {(analyticsSummary?.averageWatchSeconds ?? 0).toLocaleString()}s
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completion rate {(analyticsSummary?.completionRate ?? 0) * 100}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lead Conversion</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Inbox className="w-4 h-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">
                  {(analyticsSummary?.leadConversionRate ?? 0) * 100}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analyticsSummary?.totalLeads ?? 0} leads / {analyticsSummary?.totalViews ?? 0} views
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Properties by Views</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topByViews.map((property) => (
                    <div key={property.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{property.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state}
                        </p>
                      </div>
                      <div className="text-sm font-medium">{(property.views ?? 0).toLocaleString()} views</div>
                    </div>
                  ))}
                  {topByViews.length === 0 && (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Properties by Saves</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topBySaves.map((property) => (
                    <div key={property.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{property.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state}
                        </p>
                      </div>
                      <div className="text-sm font-medium">
                        {(savesByProperty.get(property.id) || 0).toLocaleString()} saves
                      </div>
                    </div>
                  ))}
                  {topBySaves.length === 0 && (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

