import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** react-day-picker styled like the rest of the dashboard; weeks start on Monday. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("p-0 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col", d.months),
        month: cn("flex flex-col gap-3", d.month),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", d.nav),
        button_previous: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0", d.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost" }), "size-(--cell-size) p-0", d.button_next),
        month_caption: cn("flex h-(--cell-size) items-center justify-center", d.month_caption),
        caption_label: cn("font-heading text-sm font-semibold", d.caption_label),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("text-muted-foreground w-(--cell-size) text-center text-xs font-medium", d.weekday),
        week: cn("mt-1 flex", d.week),
        day: cn("size-(--cell-size) p-0 text-center", d.day),
        day_button: cn(
          "ve-num hover:bg-accent size-(--cell-size) rounded-md text-sm transition-colors outline-none focus-visible:ring-ring/40 focus-visible:ring-[3px]",
          d.day_button
        ),
        selected: cn("[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary", d.selected),
        today: cn("[&>button]:ring-brand [&>button]:ring-1 [&>button]:ring-inset", d.today),
        outside: cn("text-muted-foreground/60", d.outside),
        disabled: cn("text-muted-foreground opacity-40", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeftIcon className={cn("size-4", c)} /> : <ChevronRightIcon className={cn("size-4", c)} />,
      }}
      {...props}
    />
  )
}

export { Calendar }
