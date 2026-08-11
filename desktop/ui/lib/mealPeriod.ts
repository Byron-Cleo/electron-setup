export const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"] as const

export type MealPeriodLabel = typeof MEAL_PERIODS[number]

export interface ActiveMealPeriod {
  period: MealPeriodLabel
  isActive: boolean
  servingHours: string
  badgeLabel: string
}

export const TIME_FILTER_ENABLED = true

export function getActiveMealPeriods(hour: number): ActiveMealPeriod[] {
  return MEAL_PERIODS.map((period) => {
    switch (period) {
      case "BREAKFAST": {
        const active = TIME_FILTER_ENABLED ? hour >= 6 && hour < 12 : true
        return { period, isActive: active, servingHours: "6:00 AM - 11:59 AM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "LUNCH": {
        const active = TIME_FILTER_ENABLED ? hour >= 12 && hour < 18 : true
        return { period, isActive: active, servingHours: "12:00 PM - 5:59 PM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "DINNER": {
        const active = TIME_FILTER_ENABLED ? hour >= 18 || hour < 6 : true
        return { period, isActive: active, servingHours: "6:00 PM - 5:59 AM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "DESSERT":
        return { period, isActive: true, servingHours: "Always Available", badgeLabel: "Always Available" }
      case "BEVERAGE":
        return { period, isActive: true, servingHours: "Always Available", badgeLabel: "Always Available" }
    }
  })
}

export function getActivePeriodLabels(hour: number): MealPeriodLabel[] {
  return getActiveMealPeriods(hour)
    .filter((p) => p.isActive)
    .map((p) => p.period)
}
