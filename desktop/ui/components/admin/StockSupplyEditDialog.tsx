import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
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
import { X, Package, Check } from "lucide-react"
import {
  getStockSupplyById,
  updateStockSupply,
  getDepartments,
  getMenus,
  formatSupplyDescription,
  stockSupplyImageUrl,
} from "@/lib/api"
import SearchableSelect from "@/components/shared/SearchableSelect"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  unit: z.enum(["KG", "PKT", "L", "ML", "PCS"], { required_error: "Unit is required" }),
  currentStock: z.coerce.number().min(0, "Stock item count is required"),
  reorderLevel: z.coerce.number().min(0, "Reorder level count is required"),
  isMenuStock: z.boolean(),
  menuId: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

const UNIT_OPTIONS = [
  { value: "KG", label: "Kilogram (KG)" },
  { value: "PKT", label: "Packets (Pkt)" },
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set())
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImage, setExistingImage] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: undefined,
      currentStock: 0,
      reorderLevel: 0,
      isMenuStock: false,
      menuId: undefined,
    },
  })

  useEffect(() => {
    if (!open) return
    form.clearErrors("root")
    setSelectedDepts(new Set())
    setImageFile(null)
    setImagePreview(null)
    setExistingImage(null)
    setLoading(true)

    Promise.all([getDepartments(), getMenus()])
      .then(([depts, menuItems]) => {
        setDepartments(depts)
        setMenus(menuItems)
        if (supplyId) {
          return getStockSupplyById(supplyId)
        }
      })
      .then((supply) => {
        if (supply) {
          form.reset({
            name: supply.name,
            description: supply.description ?? "",
            unit: supply.unit,
            currentStock: supply.currentStock,
            reorderLevel: supply.reorderLevel ?? 0,
            isMenuStock: supply.isMenuStock,
            menuId: supply.menuId ?? undefined,
          })
          setExistingImage(supply.image)
          if (supply.departments) {
            setSelectedDepts(new Set(supply.departments.map((d) => d.id)))
          }
        }
      })
      .catch((e) => form.setError("root", { message: e.message }))
      .finally(() => setLoading(false))
  }, [open, supplyId, form])

  const watchedIsMenuStock = useWatch({ control: form.control, name: "isMenuStock" })

  useEffect(() => {
    if (!watchedIsMenuStock) {
      form.setValue("menuId", undefined)
    }
  }, [watchedIsMenuStock, form])

  async function onSubmit(values: FormValues) {
    if (!supplyId) return
    form.clearErrors("root")

    if (selectedDepts.size === 0) {
      form.setError("root", { message: "At least one department must be assigned" })
      return
    }

    try {
      await updateStockSupply(supplyId, { ...values, departmentIds: Array.from(selectedDepts) }, imageFile ?? undefined)
      onSaved()
      onClose()
    } catch (e: any) {
      form.setError("root", { message: e.message })
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      form.setError("root", { message: "Image must be under 5MB" })
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setExistingImage(null)
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
                <p className="text-lg text-admin-header-text/60 text-center font-medium">
                  {formatSupplyDescription({ name: previewName, unit: previewUnit, currentStock: previewStock })}
                </p>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Supply name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Item Count <span className="text-red-500 text-base font-bold">*</span></FormLabel>
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
                      <FormLabel>Reorder Level Count <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Unit <span className="text-red-500 text-base font-bold">*</span></FormLabel>
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

                <FormField
                  control={form.control}
                  name="isMenuStock"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border p-3 mt-7">
                      <FormControl>
                        <label className="relative cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={field.value ?? false}
                            onChange={field.onChange}
                          />
                          <div className="h-5 w-5 rounded border-2 border-admin-card-border peer-checked:bg-brand-green peer-checked:border-brand-green transition-colors flex items-center justify-center">
                            {field.value && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </label>
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel>Is Menu Item?</FormLabel>
                        <p className="text-xs text-admin-header-text/50">
                          Mark this item as a menu ingredient (used for cooking)
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {watchedIsMenuStock && (
                <FormField
                  control={form.control}
                  name="menuId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menu Item</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={menus.map((m) => ({ value: m.id, label: m.name }))}
                          value={field.value ?? null}
                          onChange={(val) => field.onChange(val ?? undefined)}
                          placeholder="Select menu item"
                          searchPlaceholder="Search menus..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div>
                <label className="text-sm font-medium text-admin-header-text">Image</label>
                <p className="text-xs text-admin-header-text/50 mb-2">JPEG, PNG, or WebP. Max 5MB.</p>
                <div className="flex items-start gap-4">
                  <div className="h-24 w-24 rounded-lg border border-admin-card-border bg-admin-content flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : existingImage ? (
                      <img
                        src={stockSupplyImageUrl(existingImage) ?? ""}
                        alt="Current"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={24} className="text-admin-header-text/30" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-admin-card-border cursor-pointer hover:bg-admin-content/50 text-sm text-admin-header-text">
                      Choose Image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                    {(imagePreview || existingImage) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearImage}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {departments.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-admin-header-text">Assigned Departments <span className="text-red-500 text-base font-bold">*</span></label>
                  <p className="text-xs text-admin-header-text/50 mb-2">Which departments can order this item?</p>
                  <div className="flex flex-wrap gap-3">
                    {departments.map((dept) => {
                      const isSelected = selectedDepts.has(dept.id)
                      return (
                        <label
                          key={dept.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-admin-accent/10 border-admin-accent text-admin-header-text"
                              : "border-admin-card-border text-admin-header-text/60 hover:bg-admin-content/50"
                          }`}
                        >
                          <label className="relative cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={isSelected}
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
                            <div className="h-4 w-4 rounded border-2 border-admin-card-border peer-checked:bg-brand-green peer-checked:border-brand-green transition-colors flex items-center justify-center">
                              {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </label>
                          {dept.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

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
