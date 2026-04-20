import { useMemo } from "react";
import { Mail, Phone, Calendar } from "lucide-react";
import { useGetLeadsQuery, useUpdateLeadStatusMutation } from "@/store/api/apiSlice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusLabel: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

export default function AdminLeads() {
  const { data: leads = [], isLoading } = useGetLeadsQuery();
  const [updateLeadStatus] = useUpdateLeadStatusMutation();

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leads]);

  const handleStatusChange = async (id: string, status: "new" | "contacted" | "closed") => {
    await updateLeadStatus({ id, status }).unwrap();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2">Leads</h1>
        <p className="text-muted-foreground">Requests from interested buyers</p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => {
              window.open("/api/leads/export", "_blank");
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading leads...</span>
          </div>
        </div>
      ) : sortedLeads.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No leads yet.</div>
      ) : (
        <div className="space-y-4">
          {sortedLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-card border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{lead.name}</h3>
                  <Badge variant="secondary">{statusLabel[lead.status] ?? lead.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Property ID: <span className="font-mono">{lead.propertyId}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {lead.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {lead.email}
                    </span>
                  )}
                  {lead.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {lead.phone}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(lead.createdAt).toLocaleString()}
                  </span>
                </div>
                {lead.message && (
                  <p className="text-sm text-muted-foreground">{lead.message}</p>
                )}
                {(lead.preferredDate || lead.preferredTime || lead.contactMethod) && (
                  <p className="text-sm text-muted-foreground">
                    Preferred: {lead.preferredDate ?? "Any date"} {lead.preferredTime ?? ""} • {lead.contactMethod ?? "email"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={lead.status === "new" ? "default" : "outline"}
                  onClick={() => handleStatusChange(lead.id, "new")}
                >
                  New
                </Button>
                <Button
                  variant={lead.status === "contacted" ? "default" : "outline"}
                  onClick={() => handleStatusChange(lead.id, "contacted")}
                >
                  Contacted
                </Button>
                <Button
                  variant={lead.status === "closed" ? "default" : "outline"}
                  onClick={() => handleStatusChange(lead.id, "closed")}
                >
                  Closed
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

