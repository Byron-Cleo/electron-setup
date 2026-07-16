import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  children: React.ReactNode
}

export function Heading({ as: Tag = "h1", className, children, ...props }: Props) {
  return (
    <Tag className={cn("font-semibold", className)} {...props}>
      {children}
    </Tag>
  )
}
