import { useEffect, useRef, useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ImagePlus } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { createMenu, getMenuById, getAccompaniments, getMealTypes, menuImageUrl, updateMenu, uploadMenuImage } from "@/lib/api"

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

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    price: z.coerce.number().min(0, "Price must be 0 or more"),
    images: z.array(z.string()).optional(),
    mealTypes: z.array(z.string()).min(1, "Select at least one meal period"),
    starchId: z.string().optional(),
    vegetableId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const needsAccompaniments =
      data.mealTypes.includes("LUNCH") || data.mealTypes.includes("DINNER")
    if (!needsAccompaniments) return
    if (!data.starchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["starchId"],
        message: "Starch accompaniment is required for LUNCH/DINNER menus",
      })
    }
    if (!data.vegetableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vegetableId"],
        message: "Vegetable accompaniment is required for LUNCH/DINNER menus",
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function MenuImageField({
  value,
  onChange,
  onError,
}: {
  value: string[]
  onChange: (images: string[]) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const current = value?.[0] ?? null

  return (
    <div className="flex items-center gap-3">
      {current ? (
        <img
          src={menuImageUrl(current) ?? undefined}
          alt="Menu item"
          className="h-16 w-16 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImagePlus className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            try {
              setUploading(true)
              const { url } = await uploadMenuImage(file)
              onChange([url])
            } catch (err) {
              onError(err instanceof Error ? err.message : "Image upload failed")
            } finally {
              setUploading(false)
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : current ? "Change Image" : "Upload Image"}
        </Button>
        {current && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

export default function MenuForm({ editId, onSaved, onCancel }: Props) {
  const [mealTypeOptions, setMealTypeOptions] = useState<MealType[]>([])
  const [starchOptions, setStarchOptions] = useState<Accompaniment[]>([])
  const [vegetableOptions, setVegetableOptions] = useState<Accompaniment[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      images: [],
      mealTypes: [],
    },
  })

  const watchedMealTypes = useWatch({ control: form.control, name: "mealTypes" })
  const needsAccompaniments =
    watchedMealTypes?.includes("LUNCH") || watchedMealTypes?.includes("DINNER")

  useEffect(() => {
    async function load() {
      const [mealTypes, accs] = await Promise.all([getMealTypes(), getAccompaniments()])
      setMealTypeOptions(mealTypes)
      setStarchOptions(accs.filter((a) => a.category === "STARCH"))
      setVegetableOptions(accs.filter((a) => a.category === "VEGETABLE"))
    }
    load()
  }, [form])

  useEffect(() => {
    if (!editId) return
    getMenuById(editId)
      .then((item) => {
        form.reset({
          name: item.name,
          category: item.category,
          price: Number(item.price),
          images: item.images ?? [],
          mealTypes: item.mealTypes ?? [],
          starchId: item.starchId ?? undefined,
          vegetableId: item.vegetableId ?? undefined,
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
        images: data.images ?? [],
        mealTypes: data.mealTypes,
        starchId: data.starchId || null,
        vegetableId: data.vegetableId || null,
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

              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Image</FormLabel>
                    <MenuImageField
                      value={field.value ?? []}
                      onChange={field.onChange}
                      onError={(message) => form.setError("root", { message })}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mealTypes"
                render={() => (
                  <FormItem>
                    <FormLabel>Meal Periods <span className="text-red-500 text-base font-bold">*</span></FormLabel>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                      {mealTypeOptions
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((mt) => (
                          <FormField
                            key={mt.id}
                            control={form.control}
                            name="mealTypes"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(mt.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value ?? []
                                      if (checked) {
                                        field.onChange([...current, mt.id])
                                      } else {
                                        field.onChange(current.filter((v: string) => v !== mt.id))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Label className="text-sm font-normal cursor-pointer">{mt.name}</Label>
                              </FormItem>
                            )}
                          />
                        ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="starchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Starch Accompaniment
                        {needsAccompaniments && <span className="text-red-500 text-base font-bold">*</span>}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select starch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {starchOptions.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vegetableId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Vegetable Accompaniment
                        {needsAccompaniments && <span className="text-red-500 text-base font-bold">*</span>}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vegetable" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {vegetableOptions.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
