import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetPropertyReportsQuery, useUpdatePropertyMutation } from "@/store/api/apiSlice";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/utils";

export default function AdminReports() {
  const { data: reports = [], isLoading } = useGetPropertyReportsQuery();
  const [updateProperty] = useUpdatePropertyMutation();

  const handleHide = async (propertyId: string) => {
    try {
      await updateProperty({ id: propertyId, data: { status: "hidden" } }).unwrap();
      toast.success("Listing hidden");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2">Reports</h1>
        <p className="text-muted-foreground">Reported listings from users</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Property Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground">No reports found</p>
          ) : (
            <div className="space-y-4">
              {reports.map((report: any) => (
                <div key={report.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">Property ID: {report.propertyId}</div>
                    <div className="text-sm text-muted-foreground">Reason: {report.reason}</div>
                    {report.details && (
                      <div className="text-sm text-muted-foreground">Details: {report.details}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.open(`/property/${report.propertyId}`, "_blank")}>
                      View
                    </Button>
                    <Button variant="destructive" onClick={() => handleHide(report.propertyId)}>
                      Hide
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

