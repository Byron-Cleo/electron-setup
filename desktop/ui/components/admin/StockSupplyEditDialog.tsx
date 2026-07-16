import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  updateStockSupply,
  getStockSupplyCategories,
  getDepartments,
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

interface Props {
  open: boolean
  onClose: () => void
  supplyId: string | null
  onSaved: () => void
}

export default function StockSupplyEditDialog({ open, onClose, supplyId, onSaved }: Props) {
  const [categories, setCategories] = useState<StockSupplyCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

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
    if (!open) return
    form.clearErrors("root")
    setSelectedDepts(new Set())
    setLoading(true)

    Promise.all([getStockSupplyCategories(), getDepartments()])
      .then(([cats, depts]) => {
        setCategories(cats)
        setDepartments(depts)
        if (supplyId) {
          return getStockSupplyById(supplyId)
        }
      })
      .then((supply) => {
        if (supply) {
          form.reset({
            name: supply.name,
            description: supply.description ?? "",
            categoryId: supply.categoryId,
            unit: supply.unit,
            currentStock: supply.currentStock,
            reorderLevel: supply.reorderLevel ?? 0,
          })
          if (supply.departments) {
            setSelectedDepts(new Set(supply.departments.map((d) => d.departmentId)))
          }
        }
      })
      .catch((e) => form.setError("root", { message: e.message }))
      .finally(() => setLoading(false))
  }, [open, supplyId, form])

  async function onSubmit(values: FormValues) {
    if (!supplyId) return
    form.clearErrors("root")
    try {
      await updateStockSupply(supplyId, values)
      onSaved()
      onClose()
    } catch (e: any) {
      form.setError("root", { message: e.message })
    }
  }

  const previewName = form.watch("name") || ""
  const previewUnit = form.watch("unit") || "PCS"
  const previewStock = form.watch("currentStock") ?? 0
  const showPreview = previewName && previewUnit

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base uppercase text-admin-header-text">
            Edit Stock Supply
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-admin-header-text/60 py-4">Loading...</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {form.formState.errors.root && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.root.message}
                </p>
              )}

              {showPreview && (
                <p className="text-xs text-admin-header-text/60">
                  {formatSupplyDescription({ name: previewName, unit: previewUnit, currentStock: previewStock })}
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
                      <Textarea {...field} placeholder="Optional description" rows={2} />
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

              {departments.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-admin-header-text">Access Departments</label>
                  <p className="text-xs text-admin-header-text/50 mb-2">Which departments can order this item?</p>
                  <div className="flex flex-wrap gap-3">
                    {departments.map((dept) => (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          selectedDepts.has(dept.id)
                            ? "bg-admin-accent/10 border-admin-accent text-admin-header-text"
                            : "border-admin-card-border text-admin-header-text/60 hover:bg-admin-content/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-admin-card-border"
                          checked={selectedDepts.has(dept.id)}
                          onChange={(e) => {
                            const next = new Set(selectedDepts)
                            if (e.target.checked) {
                              next.add(dept.id)
                            } else {
                              next.delete(dept.id)
                            }
                            setSelectedDepts(next)
                          }}
                        />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={onClose} disabled={form.formState.isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-brand-green hover:bg-brand-green/90">
                  {form.formState.isSubmitting ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
