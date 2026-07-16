import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import {
  getStockSupplyById,
  createStockSupply,
  updateStockSupply,
  getStockSupplyCategories,
  formatSupplyDescription,
} from "@/lib/api"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  unit: z.enum(["KG", "G", "L", "ML", "PCS"], { required_error: "Unit is required" }),
  currentStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
})

type FormValues = z.infer<typeof formSchema>

const UNIT_OPTIONS = [
  { value: "KG", label: "Kilogram (KG)" },
  { value: "G", label: "Gram (G)" },
  { value: "L", label: "Liter (L)" },
  { value: "ML", label: "Milliliter (ML)" },
  { value: "PCS", label: "Pieces (PCS)" },
]

export default function StockSupplyForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [categories, setCategories] = useState<StockSupplyCategory[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      unit: undefined,
      currentStock: 0,
      reorderLevel: 0,
    },
  })

  useEffect(() => {
    getStockSupplyCategories()
      .then(setCategories)
      .catch((e) => form.setError("root", { message: e.message }))
  }, [form])

  useEffect(() => {
    if (!id) return
    getStockSupplyById(id)
      .then((supply) => {
        form.reset({
          name: supply.name,
          description: supply.description ?? "",
          categoryId: supply.categoryId,
          unit: supply.unit,
          currentStock: supply.currentStock,
          reorderLevel: supply.reorderLevel ?? 0,
        })
      })
      .catch((e) => form.setError("root", { message: e.message }))
  }, [id, form])

  async function onSubmit(values: FormValues) {
    form.clearErrors("root")
    try {
      if (isEdit && id) {
        await updateStockSupply(id, values)
      } else {
        await createStockSupply(values)
      }
      navigate("/admin/manager/stock-supplies")
    } catch (e: any) {
      form.setError("root", { message: e.message })
    }
  }

  const watchedName = useWatch({ control: form.control, name: "name" })
  const watchedUnit = useWatch({ control: form.control, name: "unit" })
  const watchedStock = useWatch({ control: form.control, name: "currentStock" })

  const previewName = watchedName || ""
  const previewUnit = watchedUnit || "PCS"
  const previewStock = watchedStock ?? 0
  const showPreview = isEdit || (previewName && previewUnit)

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">
        {isEdit ? "Edit Stock Supply" : "New Stock Supply"}
      </Heading>

      <div className="mb-4">
        <Button onClick={() => navigate("/admin/manager/stock-supplies")} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {showPreview && (
        <p className="text-sm text-admin-header-text/60 mb-4">
          {formatSupplyDescription({ name: previewName, unit: previewUnit, currentStock: previewStock })}
        </p>
      )}

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
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Supply name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional description" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
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
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => navigate("/admin/manager/stock-supplies")}
                  disabled={form.formState.isSubmitting}
                  className="bg-red-500 hover:bg-red-500/90"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-brand-green hover:bg-brand-green/90">
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
