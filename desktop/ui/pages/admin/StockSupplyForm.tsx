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
import { ArrowLeft, X, Package } from "lucide-react"
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
  getDepartments,
  formatSupplyDescription,
  stockSupplyImageUrl,
} from "@/lib/api"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  unit: z.enum(["KG", "PKT", "L", "ML", "PCS"], { required_error: "Unit is required" }),
  currentStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
})

type FormValues = z.infer<typeof formSchema>

const UNIT_OPTIONS = [
  { value: "KG", label: "Kilogram (KG)" },
  { value: "PKT", label: "Packets (Pkt)" },
  { value: "L", label: "Liter (L)" },
  { value: "ML", label: "Milliliter (ML)" },
  { value: "PCS", label: "Pieces (PCS)" },
]

export default function StockSupplyForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set())
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
    },
  })

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch((e) => form.setError("root", { message: e.message }))
  }, [form])

  useEffect(() => {
    if (!id) return
    getStockSupplyById(id)
      .then((supply) => {
        form.reset({
          name: supply.name,
          description: supply.description ?? "",
          unit: supply.unit,
          currentStock: supply.currentStock,
          reorderLevel: supply.reorderLevel ?? 0,
        })
        setExistingImage(supply.image)
      })
      .catch((e) => form.setError("root", { message: e.message }))
  }, [id, form])

  async function onSubmit(values: FormValues) {
    form.clearErrors("root")
    try {
      const file = imageFile ?? undefined
      if (isEdit && id) {
        await updateStockSupply(id, values, file)
      } else {
        await createStockSupply(values, file)
      }
      navigate("/admin/store/stock-supplies")
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
        <Button onClick={() => navigate("/admin/store/stock-supplies")} className="px-6 py-6">
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

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => navigate("/admin/store/stock-supplies")}
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
