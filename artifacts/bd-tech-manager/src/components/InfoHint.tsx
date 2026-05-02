import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  text: string;
  className?: string;
}

export function InfoHint({ text, className }: InfoHintProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Ver explicacao"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/55 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
