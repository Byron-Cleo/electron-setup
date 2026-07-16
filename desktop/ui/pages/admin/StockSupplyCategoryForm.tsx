import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Heading } from "@/components/ui/heading"
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
  getStockSupplyCategoryById,
  createStockSupplyCategory,
  updateStockSupplyCategory,
} from "@/lib/api"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function StockSupplyCategoryForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  })

  useEffect(() => {
    if (!id) return
    getStockSupplyCategoryById(id)
      .then((cat) => {
        form.reset({ name: cat.name, description: cat.description ?? "" })
      })
      .catch((e) => form.setError("root", { message: e.message }))
  }, [id, form])

  async function onSubmit(values: FormValues) {
    form.clearErrors("root")
    try {
      if (isEdit && id) {
        await updateStockSupplyCategory(id, values)
      } else {
        await createStockSupplyCategory(values)
      }
      navigate("/admin/manager/stock-supply-categories")
    } catch (e: any) {
      form.setError("root", { message: e.message })
    }
  }

  return (
    <div>
      <Heading as="h1" className="mb-6 text-admin-header-text">
        {isEdit ? "Edit Category" : "New Stock Supply Category"}
      </Heading>

      <div className="mb-4">
        <Button onClick={() => navigate("/admin/manager/stock-supply-categories")} className="px-6 py-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

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
                      <Input {...field} placeholder="Category name" />
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

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => navigate("/admin/manager/stock-supply-categories")}
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
