---
tags: [base-ui, shadcn, react, polymorphism]
---

# base-ui-react-gaps

## base-ui Polymorphism Limits

**asChild not supported.** Unlike Radix, base-ui components are not polymorphic. `asChild` prop ignored; component can't delegate render.

**Affected components:** Tabs, DropdownMenu, Avatar, others.

**Workaround:** Use semantic HTML + className styling. Example:
```tsx
// Don't use asChild
<DropdownMenuTrigger asChild>
  <Button>Menu</Button>
</DropdownMenuTrigger>

// Instead:
<DropdownMenuTrigger className={cn(buttonVariants())}>Menu</DropdownMenuTrigger>
// OR
const TriggerButton = () => <Link href="/" className={cn(buttonVariants())}>Menu</Link>;
```

**shadcn compatibility:** `npx shadcn add` generates base-ui components. Check docs before assuming Radix API.

