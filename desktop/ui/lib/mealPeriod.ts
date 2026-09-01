export const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "DINNER", "DESSERT", "BEVERAGE"] as const

export type MealPeriodLabel = typeof MEAL_PERIODS[number]

export interface ActiveMealPeriod {
  period: MealPeriodLabel
  isActive: boolean
  servingHours: string
  badgeLabel: string
}

export const TIME_FILTER_ENABLED = true
// export const TIME_FILTER_ENABLED = false

export function getActiveMealPeriods(hour: number): ActiveMealPeriod[] {
  return MEAL_PERIODS.map((period) => {
    switch (period) {
      case "BREAKFAST": {
        const active = TIME_FILTER_ENABLED ? (hour >= 5 && hour < 12) && !(hour === 5 && new Date().getMinutes() < 30) : true
        return { period, isActive: active, servingHours: "5:30 AM - 11:59 AM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "LUNCH": {
        const active = TIME_FILTER_ENABLED ? hour >= 12 && hour < 17 || (hour === 17 && new Date().getMinutes() < 30) : true
        return { period, isActive: active, servingHours: "12:00 PM - 5:29 PM", badgeLabel: active ? "Now Serving" : "Closed" }
      }
      case "DINNER": {
        const active = TIME_FILTER_ENABLED ? hour >= 17 && new Date().getMinutes() >= 30 || hour >= 18 || hour < 5 || (hour === 5 && new Date().getMinutes() < 30) : true
        return { period, isActive: active, servingHours: "5:30 PM - 5:29 AM", badgeLabel: active ? "Now Serving" : "Closed" }
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
