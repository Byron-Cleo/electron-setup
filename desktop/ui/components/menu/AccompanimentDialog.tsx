import { useEffect, useRef, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ImagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createAccompaniment, updateAccompaniment, uploadAccompanimentImage, menuImageUrl } from "@/lib/api"

const CATEGORIES = ["STARCH", "VEGETABLE"] as const

interface Props {
  open: boolean
  onClose: () => void
  editItem: Accompaniment | null
  onSaved: () => void
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Price must be 0 or more").optional()
  ),
  description: z.string().optional(),
  isDefault: z.boolean(),
  image: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

function AccompanimentImageField({
  value,
  onChange,
  onError,
}: {
  value: string | undefined
  onChange: (image: string) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const current = value ?? ""

  return (
    <div className="flex items-center gap-3">
      {current ? (
        <img
          src={menuImageUrl(current) ?? undefined}
          alt="Accompaniment"
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
              const { url } = await uploadAccompanimentImage(file)
              onChange(url)
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
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

export default function AccompanimentDialog({ open, onClose, editItem, onSaved }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      name: "",
      category: "",
      price: undefined,
      description: "",
      isDefault: false,
      image: "",
    },
  })

  useEffect(() => {
    if (!open) return
    if (editItem) {
      form.reset({
        name: editItem.name,
        category: editItem.category,
        price: editItem.price === null ? undefined : Number(editItem.price),
        description: editItem.description ?? "",
        isDefault: editItem.isDefault,
        image: editItem.image ?? "",
      })
    } else {
      form.reset({
        name: "",
        category: "",
        price: undefined,
        description: "",
        isDefault: false,
        image: "",
      })
    }
  }, [open, editItem, form])

  async function onSubmit(data: FormValues) {
    try {
      const payload: AccompanimentCreateData = {
        name: data.name,
        category: data.category,
        ...(data.price !== undefined && { price: data.price }),
        ...(data.description !== undefined && data.description !== "" && { description: data.description }),
        ...(data.image !== undefined && { image: data.image }),
        isDefault: data.isDefault,
      }
      if (editItem) {
        await updateAccompaniment(editItem.id, payload)
      } else {
        await createAccompaniment(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "An error occurred" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Menu Accompaniment" : "Create Menu Accompaniment"}</DialogTitle>
        </DialogHeader>

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
                    <Input {...field} placeholder="e.g. Sukuma Wiki" />
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
                    <FormLabel>Price (KSh)</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
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
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <Label className="text-sm font-normal cursor-pointer">Default accompaniment</Label>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <AccompanimentImageField
                    value={field.value}
                    onChange={field.onChange}
                    onError={(message) => form.setError("root", { message })}
                  />
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
                    <Textarea {...field} placeholder="Optional description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}