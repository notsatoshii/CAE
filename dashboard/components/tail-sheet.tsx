"use client"

import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TailPanel } from "@/components/tail-panel"

interface TailSheetProps {
  tail: string
  backHref: string
}

export function TailSheet({ tail, backHref }: TailSheetProps) {
  const router = useRouter()
  return (
    <Sheet open onOpenChange={(open) => { if (!open) router.push(backHref) }}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Live output</SheetTitle>
        </SheetHeader>
        <TailPanel path={tail} />
      </SheetContent>
    </Sheet>
  )
}
