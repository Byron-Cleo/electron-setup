import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStockSupplies } from "@/lib/api";

interface Props {
  editId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const CATEGORIES = [
  "Beef ",
  "Chicken",
  "Vegetable",
  "Drinks",
  "Beverage",
  "Soup",
  "Startch",
];

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().min(1, "Brand is required"),
  description: z.string().min(1, "Description is required"),
  stock: z.number().min(0, "Stock must be 0 or more"),
  price: z.number().min(0, "Price must be 0 or more"),
  isFeatured: z.boolean(),
  stockSupplyId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function MenuForm({ editId, onSaved, onCancel }: Props) {
  const [stockSupplies, setStockSupplies] = useState<StockSupply[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      brand: "",
      description: "",
      stock: 0,
      price: 0,
      isFeatured: false,
      stockSupplyId: undefined,
    },
  });

  useEffect(() => {
    getStockSupplies()
      .then((items) => setStockSupplies(items.filter((s) => s.platesPerUnit && Number(s.platesPerUnit) > 0)))
      .catch(() => {})
  }, []);

  useEffect(() => {
    if (!editId) return;
    window.electron.menu.getById(editId).then((item) => {
      form.reset({
        name: item.name,
        category: item.category,
        brand: item.brand,
        description: item.description,
        stock: item.stock,
        price: Number(item.price),
        isFeatured: item.isFeatured,
        stockSupplyId: undefined,
      });
    }).catch((err) => {
      form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" });
    });
  }, [editId, form]);

  async function onSubmit(data: FormValues) {
    try {
      const payload = { ...data, slug: slugify(data.name) };
      if (editId) {
        await window.electron.menu.update(editId, payload);
      } else {
        await window.electron.menu.create(payload);
      }
      onSaved();
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" });
    }
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{editId ? "Edit Menu Item" : "New Menu Item"}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Garri &amp; Egusi Soup" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="stockSupplyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Item (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Link to a stock item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stockSupplies.map((supply) => (
                        <SelectItem key={supply.id} value={supply.id}>
                          {supply.name} ({supply.platesPerUnit} plates/{supply.unit.toLowerCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link to a stock item with plates per unit configured
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input placeholder="Eraeva Delicacies" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the menu item..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₦)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel>Featured</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Show this item on the featured section
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
