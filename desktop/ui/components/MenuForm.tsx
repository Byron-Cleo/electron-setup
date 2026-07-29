import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createMenu, getMenuById, updateMenu } from "@/lib/api"

interface Props {
  editId: string | null
  onSaved: () => void
  onCancel: () => void
}

const CATEGORIES = [
  "Beef",
  "Chicken",
  "Vegetable",
  "Drinks",
  "Beverage",
  "Starch",
  "Fish",
  "1/2 Fish",
  "Liver",
  "Matumbo",
  "Snacks",
]

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
})

type FormValues = z.infer<typeof formSchema>

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

export default function MenuForm({ editId, onSaved, onCancel }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      category: "",
      price: 0,
    },
  })

  useEffect(() => {
    if (!editId) return
    getMenuById(editId)
      .then((item) => {
        form.reset({
          name: item.name,
          category: item.category,
          price: Number(item.price),
        })
      })
      .catch((err) => {
        form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" })
      })
  }, [editId, form])

  async function onSubmit(data: FormValues) {
    try {
      const payload = {
        name: data.name,
        slug: slugify(data.name),
        category: data.category,
        price: data.price,
      }
      if (editId) {
        await updateMenu(editId, payload)
      } else {
        await createMenu(payload)
      }
      onSaved()
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" })
    }
  }

  return (
    <div>
      <Heading as="h2" className="mb-6 text-center text-admin-header-text">
        {editId ? "Edit Menu Item" : "New Menu Item"}
      </Heading>

      <Card className="bg-admin-card border-admin-card-border mx-auto max-w-lg">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {form.formState.errors.root && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.root.message}
                </p>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Menu item name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
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
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Food Price (KSh) <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={onCancel}
                  disabled={form.formState.isSubmitting}
                  className="bg-red-500 hover:bg-red-500/90"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="bg-brand-green hover:bg-brand-green/90"
                >
                  {form.formState.isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
