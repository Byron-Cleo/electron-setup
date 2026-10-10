import { useEffect, useRef, useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ImagePlus, Plus, Trash2 } from "lucide-react"

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createMenu, getMenuById, getAccompaniments, getMealTypes, getCategories, menuImageUrl, updateMenu, uploadMenuImage } from "@/lib/api"

interface Props {
  editId: string | null
  onSaved: () => void
  onCancel: () => void
}

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    price: z.coerce.number().min(0, "Price must be 0 or more"),
    // Direct sale = no cooking batches: stock is keyed in here and decrements
    // per order. Cooked items (the default) leave stock to the pool engine.
    isDirectSale: z.enum(["yes", "no"]),
    directStock: z.coerce.number().min(0, "Stock must be 0 or more"),
    images: z.array(z.string()).optional(),
    mealTypes: z.array(z.string()).min(1, "Select at least one meal period"),
    hasStarch: z.enum(["yes", "no"]),
    hasVegetable: z.enum(["yes", "no"]),
    starchId: z.string().optional(),
    vegetableId: z.string().optional(),
    hasPortion: z.enum(["yes", "no"]),
    // Dish-owned sizes (Fried Eggs 1pc / 2pc). Exactly one row carries
    // isDefault, which the server turns into Menu.portionId.
    portions: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, "Name is required"),
          price: z.coerce.number().min(0, "Price must be 0 or more"),
          platesPerServing: z.coerce.number().min(0.01, "Must be more than 0"),
          isDefault: z.boolean(),
        }),
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    // Starch/vegetable/portions only apply to cooked dishes — the controls are
    // hidden for direct-sale items, so their rules must not fire either.
    if (data.isDirectSale === "yes") return
    if (data.hasStarch === "yes" && !data.starchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["starchId"],
        message: "Starch accompaniment is required when serving with starch",
      })
    }
    if (data.hasVegetable === "yes" && !data.vegetableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vegetableId"],
        message: "Vegetable accompaniment is required when serving with vegetable",
      })
    }
    if (data.hasPortion === "yes" && data.portions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["portions"],
        message: "Add at least one portion option",
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
  const images = value ?? []

  async function handleUpload(file: File) {
    try {
      setUploading(true)
      const { url } = await uploadMenuImage(file)
      onChange([...images, url])
    } catch (err) {
      onError(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative">
              <img
                src={menuImageUrl(url) ?? undefined}
                alt={`Menu image ${i + 1}`}
                className="h-16 w-16 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600 cursor-pointer"
                aria-label={`Remove image ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        {images.length === 0 && (
          <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            await handleUpload(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Add Image"}
        </Button>
      </div>
    </div>
  )
}

export default function MenuForm({ editId, onSaved, onCancel }: Props) {
  const [mealTypeOptions, setMealTypeOptions] = useState<MealType[]>([])
  const [starchOptions, setStarchOptions] = useState<Accompaniment[]>([])
  const [vegetableOptions, setVegetableOptions] = useState<Accompaniment[]>([])
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      isDirectSale: "no",
      directStock: 0,
      images: [],
      mealTypes: [],
      hasStarch: "no",
      hasVegetable: "no",
      hasPortion: "no",
      portions: [],
    },
  })

  const watchedIsDirectSale = useWatch({ control: form.control, name: "isDirectSale" })
  const watchedHasStarch = useWatch({ control: form.control, name: "hasStarch" })
  const watchedHasVegetable = useWatch({ control: form.control, name: "hasVegetable" })
  const watchedHasPortion = useWatch({ control: form.control, name: "hasPortion" })
  const watchedPortions = useWatch({ control: form.control, name: "portions" }) ?? []

  useEffect(() => {
    async function load() {
      const [mealTypes, accs, cats] = await Promise.all([getMealTypes(), getAccompaniments(), getCategories()])
      setMealTypeOptions(mealTypes)
      setStarchOptions(accs.filter((a) => a.category === "STARCH"))
      setVegetableOptions(accs.filter((a) => a.category === "VEGETABLE"))
      setCategoryOptions(cats)
    }
    load()
  }, [form])

  useEffect(() => {
    if (!editId) return
    getMenuById(editId)
      .then((item) => {
        const hasDefault = (item.portionOptions ?? []).some((p) => p.id === item.defaultPortionId)
        const portions = (item.portionOptions ?? []).map((p, index) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          platesPerServing: Number(p.platesPerServing ?? 1),
          // Fall back to the first option so the radio always has a value,
          // even for rows saved before the default pointer existed.
          isDefault: p.id === item.defaultPortionId || (index === 0 && !hasDefault),
        }))
        form.reset({
          name: item.name,
          category: item.category,
          price: Number(item.price),
          isDirectSale: item.requiresCooking === false ? "yes" : "no",
          directStock: Number(item.stock ?? 0),
          images: item.images ?? [],
          mealTypes: item.mealTypes ?? [],
          hasStarch: item.hasStarch ? "yes" : "no",
          hasVegetable: item.hasVegetable ? "yes" : "no",
          starchId: item.starchId ?? undefined,
          vegetableId: item.vegetableId ?? undefined,
          hasPortion: portions.length > 0 ? "yes" : "no",
          portions,
        })
      })
      .catch((err) => {
        form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" })
      })
  }, [editId, form])

  function writePortions(next: FormValues["portions"]) {
    form.setValue("portions", next, { shouldDirty: true, shouldValidate: true })
  }

  function updatePortion(index: number, patch: Partial<FormValues["portions"][number]>) {
    writePortions(watchedPortions.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addPortion() {
    // A 1 pc option is what the dish already costs, so start from that.
    writePortions([
      ...watchedPortions,
      {
        name: "",
        price: Number(form.getValues("price")) || 0,
        platesPerServing: 1,
        isDefault: watchedPortions.length === 0,
      },
    ])
  }

  function removePortion(index: number) {
    const next = watchedPortions.filter((_, i) => i !== index)
    // Keep exactly one default so the radio group never goes dark.
    if (next.length > 0 && !next.some((row) => row.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    writePortions(next)
  }

  async function onSubmit(data: FormValues) {
    try {
      const payload = {
        name: data.name,
        slug: slugify(data.name),
        category: data.category,
        price: data.price,
        requiresCooking: data.isDirectSale !== "yes",
        // Only direct-sale items carry a keyed stock number. Cooked items do
        // not send stock at all — the server rejects it to protect the
        // pool-derived mirror.
        ...(data.isDirectSale === "yes" ? { stock: data.directStock } : {}),
        images: data.images ?? [],
        mealTypes: data.mealTypes,
        hasStarch: data.hasStarch === "yes",
        hasVegetable: data.hasVegetable === "yes",
        starchId: data.starchId || null,
        vegetableId: data.vegetableId || null,
        // Turning portions off clears them, the same way "no starch" nulls
        // starchId — otherwise the dish would keep selling sizes it no longer
        // offers.
        portions:
          data.hasPortion === "yes"
            ? data.portions.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.price,
                platesPerServing: p.platesPerServing,
                isDefault: p.isDefault,
              }))
            : [],
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

      <Card className="bg-admin-card border-admin-card-border w-full">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {form.formState.errors.root && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.root.message}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6">
              {/* Left column — dish fields up to starch/vegetable + actions */}
              <div className="space-y-4">

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
                      <Select key={field.value || "empty"} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
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
                name="isDirectSale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direct sale (no cooking)?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="yes" id="direct-yes" />
                          <Label htmlFor="direct-yes" className="font-normal cursor-pointer">Yes</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="no" id="direct-no" />
                          <Label htmlFor="direct-no" className="font-normal cursor-pointer">No</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      Yes for ready-to-sell items (soda, water, packaging): stock is
                      keyed in and each order takes from it. No for kitchen dishes
                      cooked in batches.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Images</FormLabel>
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

              </div>

              {/* Right column — direct-sale stock, or starch/vegetable + portions */}
              <div className="space-y-3">
                {watchedIsDirectSale === "yes" ? (
                  <FormField
                    control={form.control}
                    name="directStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock on hand</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" step="1" placeholder="e.g. 20" />
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Units ready to sell right now. Each order takes from this
                          number until it hits 0 (the waiter card then shows Sold
                          Out). Key in a new amount here anytime to top up.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                <>
                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="hasStarch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Served with Starch?</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="yes" id="starch-yes" />
                              <Label htmlFor="starch-yes" className="font-normal cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="no" id="starch-no" />
                              <Label htmlFor="starch-no" className="font-normal cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedHasStarch === "yes" && (
                    <FormField
                      control={form.control}
                      name="starchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Starch Accompaniment <span className="text-red-500 text-base font-bold">*</span>
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
                  )}
                </div>

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="hasVegetable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Served with Vegetable?</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="yes" id="veg-yes" />
                              <Label htmlFor="veg-yes" className="font-normal cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="no" id="veg-no" />
                              <Label htmlFor="veg-no" className="font-normal cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedHasVegetable === "yes" && (
                    <FormField
                      control={form.control}
                      name="vegetableId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Vegetable Accompaniment <span className="text-red-500 text-base font-bold">*</span>
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
                   )}
                 </div>
                 </div>

                 <FormField
                   control={form.control}
                   name="hasPortion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sold in Portions?</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id="portion-yes" />
                            <Label htmlFor="portion-yes" className="font-normal cursor-pointer">Yes</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id="portion-no" />
                            <Label htmlFor="portion-no" className="font-normal cursor-pointer">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedHasPortion === "yes" && (
                  <FormField
                    control={form.control}
                    name="portions"
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Portion Options <span className="text-red-500 text-base font-bold">*</span>
                        </FormLabel>
                        <p className="text-xs text-gray-500">
                          e.g. <span className="font-semibold">1 pc</span> = 1 egg and{" "}
                          <span className="font-semibold">2 pc</span> = 2 eggs. Three eggs is
                          quantity 3 on 1 pc.
                        </p>

                        {/* The default choice spans the whole list, so the
                            RadioGroup owns the rows and the field inputs are
                            driven straight off form state. */}
                        <RadioGroup
                          value={String(Math.max(0, watchedPortions.findIndex((p) => p.isDefault)))}
                          onValueChange={(value) => {
                            const chosen = Number(value)
                            writePortions(
                              watchedPortions.map((row, i) => ({ ...row, isDefault: i === chosen })),
                            )
                          }}
                          className="space-y-2 max-h-[55vh] overflow-y-auto pr-1"
                        >
                          {watchedPortions.map((row, index) => (
                            <div key={index} className="flex items-end gap-2 rounded-md border p-3">
                              <div className="grid flex-1 grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500" htmlFor={`portion-name-${index}`}>
                                    Name
                                  </Label>
                                  <Input
                                    id={`portion-name-${index}`}
                                    value={row.name}
                                    onChange={(e) => updatePortion(index, { name: e.target.value })}
                                    placeholder="1 pc"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500" htmlFor={`portion-price-${index}`}>
                                    Price
                                  </Label>
                                  <Input
                                    id={`portion-price-${index}`}
                                    type="number"
                                    min={0}
                                    value={row.price}
                                    onChange={(e) =>
                                      updatePortion(index, {
                                        price: e.target.value === "" ? 0 : Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500" htmlFor={`portion-plates-${index}`}>
                                    Plates / serving
                                  </Label>
                                  <Input
                                    id={`portion-plates-${index}`}
                                    type="number"
                                    min={0.01}
                                    step="any"
                                    value={row.platesPerServing}
                                    onChange={(e) =>
                                      updatePortion(index, {
                                        platesPerServing: e.target.value === "" ? 0 : Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-1 pb-1">
                                <RadioGroupItem value={String(index)} id={`portion-default-${index}`} />
                                <Label
                                  htmlFor={`portion-default-${index}`}
                                  className="text-xs cursor-pointer"
                                >
                                  Default
                                </Label>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                aria-label={`Remove ${row.name || "portion"}`}
                                onClick={() => removePortion(index)}
                                className="text-red-500 hover:text-red-500"
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          ))}
                        </RadioGroup>

                        <Button type="button" variant="outline" size="sm" onClick={addPortion}>
                          <Plus className="mr-1" /> Add portion
                        </Button>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                </>
                )}
              </div>
              </div>

              <div className="flex justify-center gap-2 pt-2">
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
