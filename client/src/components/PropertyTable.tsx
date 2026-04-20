import { useState } from "react";
import { Pencil, Trash2, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPricePKR } from "@/lib/utils";
import type { Property } from "@shared/schema";

interface PropertyTableProps {
  properties: Property[];
  onEdit: (property: Property) => void;
  onDelete: (propertyId: string) => void;
  onPreview: (propertyId: string) => void;
}

export function PropertyTable({ properties, onEdit, onDelete, onPreview }: PropertyTableProps) {

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Thumbnail</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                No properties found
              </TableCell>
            </TableRow>
          ) : (
            properties.map((property) => (
              <TableRow
                key={property.id}
                className="hover-elevate cursor-pointer"
                data-testid={`row-property-${property.id}`}
              >
                <TableCell>
                  <div className="relative w-28 h-20 rounded-lg overflow-hidden bg-muted">
                    {property.thumbnailUrl ? (
                      <img
                        src={property.thumbnailUrl}
                        alt={property.title ?? "Property"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Eye className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold" data-testid={`text-address-${property.id}`}>
                      {property.address ?? "No address"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {property.city ?? ""}, {property.state ?? ""}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono font-semibold" data-testid={`text-price-${property.id}`}>
                    {formatPricePKR(property.price)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(property.status ?? "active")} data-testid={`badge-status-${property.id}`}>
                    {property.status ?? "active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono" data-testid={`text-views-${property.id}`}>
                  {(property.views ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onPreview(property.id)}
                      data-testid={`button-preview-${property.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(property)}
                      data-testid={`button-edit-${property.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(property.id)}
                      data-testid={`button-delete-${property.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
