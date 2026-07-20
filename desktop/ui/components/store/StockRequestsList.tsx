import { RequestStockDesign } from "@/components/shared/RequestStockDesign"

interface Props {
  onRequestFulfilled: () => void
}

export function StockRequestsList({ onRequestFulfilled }: Props) {
  return (
    <RequestStockDesign
      showDepartmentColumn={true}
      showActionColumn={true}
      onRequestFulfilled={onRequestFulfilled}
    />
  )
}
