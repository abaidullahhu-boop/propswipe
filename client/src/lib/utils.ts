import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPricePKR(price: string | number): string {
  const numericPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericPrice);
}

export function getApiErrorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const err: any = error
    // RTK Query FetchBaseQueryError shape: { status, data }
    if (err.data) {
      const data = err.data
      if (typeof data === "string") return data
      if (data && typeof data === "object") {
        if (typeof data.error === "string") return data.error
        if (typeof data.message === "string") return data.message
      }
    }
    // SerializedError or generic
    if (typeof err.error === "string") return err.error
    if (typeof err.message === "string") return err.message
  }
  return "Something went wrong"
}

export function throttle<T extends (...args: any[]) => any>(fn: T, wait: number) {
  let lastTime = 0
  let timeout: any
  let lastArgs: any[] | null = null

  const invoke = (context: any, args: any[]) => {
    lastTime = Date.now()
    fn.apply(context, args)
  }

  return function(this: any, ...args: any[]) {
    const now = Date.now()
    const remaining = wait - (now - lastTime)
    lastArgs = args

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      invoke(this, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        if (lastArgs) invoke(this, lastArgs)
        lastArgs = null
      }, remaining)
    }
  } as T
}
