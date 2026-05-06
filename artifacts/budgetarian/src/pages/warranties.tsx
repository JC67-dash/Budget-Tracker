import { useState } from "react";
import {
  useListWarranties,
  getListWarrantiesQueryKey,
  useCreateWarranty,
  useDeleteWarranty,
  getGetExpiringSoonWarrantiesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShieldCheck, AlertTriangle, Upload, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO, differenceInDays } from "date-fns";
import { useUpload } from "@workspace/object-storage-web";

const warrantySchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  store: z.string().optional(),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  notes: z.string().optional(),
});

export default function Warranties() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: warrantiesData, isLoading } = useListWarranties({
    query: { queryKey: getListWarrantiesQueryKey() },
  });

  const createWarranty = useCreateWarranty({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWarrantiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExpiringSoonWarrantiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAddOpen(false);
        setReceiptPath(undefined);
        form.reset();
        toast({ title: "Warranty added" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to add warranty", description: err.message, variant: "destructive" });
      },
    },
  });

  const deleteWarranty = useDeleteWarranty({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWarrantiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExpiringSoonWarrantiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Warranty deleted" });
      },
    },
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (result) => {
      setReceiptPath(result.objectPath);
      toast({ title: "Receipt uploaded" });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof warrantySchema>>({
    resolver: zodResolver(warrantySchema),
    defaultValues: {
      productName: "",
      store: "",
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      expiryDate: "",
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof warrantySchema>) => {
    createWarranty.mutate({
      data: { ...data, receiptPath },
    });
  };

  const warranties = warrantiesData?.warranties ?? [];
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Warranty Keeper</h1>
          <p className="text-muted-foreground mt-1">Track product warranties and expiry dates.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setReceiptPath(undefined); }}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-sm hover-elevate" data-testid="button-add-warranty">
              <Plus className="h-4 w-4 mr-2" /> Add Warranty
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Warranty Entry</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Samsung 65 inch TV" {...field} data-testid="input-warranty-product" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="store"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="SM Appliance Center" {...field} data-testid="input-warranty-store" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-warranty-purchase-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-warranty-expiry-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Receipt Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Receipt Image (optional)</label>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="receipt-upload"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors text-sm text-muted-foreground ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                      data-testid="label-receipt-upload"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading..." : "Upload receipt"}
                    </label>
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                      data-testid="input-receipt-file"
                    />
                    {receiptPath && (
                      <span className="text-xs text-teal-600 flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" /> Uploaded
                      </span>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Claim instructions, serial number..." {...field} data-testid="textarea-warranty-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createWarranty.isPending || isUploading} data-testid="button-submit-warranty">
                    Save Warranty
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : warranties.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No warranties yet</h3>
          <p className="text-muted-foreground mb-6">Add your first product warranty to start tracking.</p>
          <Button onClick={() => setIsAddOpen(true)} className="rounded-full" data-testid="button-add-first-warranty">
            <Plus className="h-4 w-4 mr-2" /> Add Warranty
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warranties.map((w) => {
            const daysLeft = differenceInDays(parseISO(w.expiryDate), today);
            const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;
            const isExpired = daysLeft < 0;

            return (
              <Card
                key={w.id}
                className={`border shadow-sm group transition-all ${isExpiringSoon && !isExpired ? "border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10" : isExpired ? "border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10" : "border-border"}`}
                data-testid={`card-warranty-${w.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`h-4 w-4 shrink-0 ${isExpired ? "text-rose-500" : isExpiringSoon ? "text-amber-500" : "text-teal-600"}`} />
                        <h3 className="font-semibold text-foreground truncate">{w.productName}</h3>
                      </div>
                      {w.store && <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.store}</p>}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                          data-testid={`button-delete-warranty-${w.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this warranty?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{w.productName}" will be permanently removed. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-warranty-${w.id}`}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteWarranty.mutate({ id: w.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-warranty-${w.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchased</span>
                      <span className="text-foreground">{format(parseISO(w.purchaseDate), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="text-foreground">{format(parseISO(w.expiryDate), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    {isExpired ? (
                      <Badge variant="outline" className="text-xs border-rose-300 text-rose-700 dark:text-rose-400" data-testid={`badge-expired-${w.id}`}>
                        Expired
                      </Badge>
                    ) : isExpiringSoon ? (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400" data-testid={`badge-expiring-${w.id}`}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {daysLeft === 0 ? "Expires Today" : `${daysLeft}d left`}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-valid-${w.id}`}>
                        {daysLeft}d remaining
                      </Badge>
                    )}

                    {w.receiptPath && (
                      <a
                        href={`/api/storage${w.receiptPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 underline underline-offset-2"
                        data-testid={`link-receipt-${w.id}`}
                      >
                        <Receipt className="h-3.5 w-3.5" /> View Receipt
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
