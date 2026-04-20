import { ReactNode, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPropertySchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyLocationPicker } from "@/components/PropertyLocationPicker";

const propertyFormSchema = insertPropertySchema.extend({
  price: z.string().min(1, "Price is required"),
  bathrooms: z.string().min(1, "Bathrooms is required"),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface PropertyFormProps {
  onSubmit: (data: PropertyFormData) => void;
  defaultValues?: Partial<PropertyFormData>;
  isSubmitting?: boolean;
  hideMediaFields?: boolean;
  hideLocationFields?: boolean;
  addressFieldExtras?: ReactNode;
}

export function PropertyForm({
  onSubmit,
  defaultValues,
  isSubmitting,
  hideMediaFields,
  hideLocationFields,
  addressFieldExtras,
}: PropertyFormProps) {
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      title: "",
      address: "",
      city: "",
      state: "",
      neighborhood: "",
      latitude: "",
      longitude: "",
      price: "",
      bedrooms: 1,
      bathrooms: "1",
      squareFeet: 1000,
      description: "",
      videoUrl: "",
      thumbnailUrl: "",
      status: "active",
      ...defaultValues,
    },
  });

  const { setValue } = form;
  useEffect(() => {
    if (!hideMediaFields) return;
    if (defaultValues?.videoUrl) {
      setValue("videoUrl", defaultValues.videoUrl);
    }
    if (defaultValues?.thumbnailUrl !== undefined) {
      setValue("thumbnailUrl", defaultValues.thumbnailUrl ?? "");
    }
  }, [hideMediaFields, defaultValues?.videoUrl, defaultValues?.thumbnailUrl, setValue]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Title</FormLabel>
                <FormControl>
                  <Input data-testid="input-title" placeholder="Beautiful Family Home" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input data-testid="input-price" type="number" placeholder="500000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input data-testid="input-address" placeholder="123 Main Street" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {addressFieldExtras ? <div className="md:col-span-2">{addressFieldExtras}</div> : null}

          {!hideLocationFields && (
            <div className="md:col-span-2">
              <PropertyLocationPicker
                latitude={
                  form.watch("latitude") !== undefined && form.watch("latitude") !== null && form.watch("latitude") !== ""
                    ? Number(form.watch("latitude"))
                    : undefined
                }
                longitude={
                  form.watch("longitude") !== undefined && form.watch("longitude") !== null && form.watch("longitude") !== ""
                    ? Number(form.watch("longitude"))
                    : undefined
                }
                address={form.watch("address") ?? ""}
                city={form.watch("city") ?? ""}
                state={form.watch("state") ?? ""}
                onChange={(value) => {
                  form.setValue("latitude", value.latitude.toFixed(6));
                  form.setValue("longitude", value.longitude.toFixed(6));
                  if (value.address) {
                    form.setValue("address", value.address);
                  }
                  if (value.city) {
                    form.setValue("city", value.city);
                  }
                  if (value.state) {
                    form.setValue("state", value.state);
                  }
                }}
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input data-testid="input-city" placeholder="San Francisco" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input data-testid="input-state" placeholder="CA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Neighborhood</FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-neighborhood"
                    placeholder="Downtown"
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!hideLocationFields && (
            <>
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-latitude"
                        type="number"
                        step="0.000001"
                        value={field.value ?? ""}
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-longitude"
                        type="number"
                        step="0.000001"
                        value={field.value ?? ""}
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="bedrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bedrooms</FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-bedrooms"
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bathrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bathrooms</FormLabel>
                <FormControl>
                  <Input data-testid="input-bathrooms" type="number" step="0.5" min="0" max="99.9" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="squareFeet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Square Feet</FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-sqft"
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {hideMediaFields ? (
            <>
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => <input type="hidden" {...field} value={field.value ?? ""} />}
              />
              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => <input type="hidden" {...field} value={field.value ?? ""} />}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Video URL</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-video-url"
                        placeholder="https://storage.supabase.co/..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Thumbnail URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-thumbnail-url"
                        placeholder="https://storage.supabase.co/..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="input-description"
                    placeholder="Describe the property..."
                    className="resize-none"
                    rows={4}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          data-testid="button-submit-property"
          type="submit"
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {isSubmitting ? "Saving..." : "Save Property"}
        </Button>
      </form>
    </Form>
  );
}
