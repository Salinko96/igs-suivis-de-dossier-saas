import * as React from "react";
import { useLocation } from "wouter";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export interface BreadcrumbStep {
  label: string;
  href?: string;
  active?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbStep[];
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export function Breadcrumbs({
  items,
  backHref,
  backLabel = "Retour",
  onBack,
  showBackButton = true,
  className,
}: BreadcrumbsProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      setLocation(backHref);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 py-1.5 text-sm",
        className
      )}
      aria-label="Fil d'Ariane & Navigation rapide"
    >
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 rounded-xl border border-[#dfe8e4] bg-white px-2.5 text-xs font-medium text-[#2d4d44] shadow-sm hover:bg-[#ebf4f0] hover:text-[#123e34] transition-colors"
            title="Revenir à la page précédente"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 text-[#1d7764]" />
            <span>{backLabel}</span>
          </Button>
        )}

        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList className="text-xs font-medium text-[#657973]">
            {items.map((item, index) => {
              const isLast = index === items.length - 1 || item.active;
              const isFirst = index === 0;

              return (
                <React.Fragment key={item.label + index}>
                  {index > 0 && (
                    <BreadcrumbSeparator className="text-[#a5b5b0]">
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-semibold text-[#123e34] max-w-[200px] truncate sm:max-w-[340px]">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        asChild
                        className="flex items-center gap-1 text-[#5b706a] hover:text-[#123e34] cursor-pointer transition-colors"
                      >
                        <a
                          href={item.href || "#"}
                          onClick={e => {
                            if (item.href) {
                              e.preventDefault();
                              setLocation(item.href);
                            }
                          }}
                        >
                          {isFirst && <Home className="h-3.5 w-3.5 text-[#1d7764] mr-0.5 inline-block" />}
                          {item.label}
                        </a>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Mobile Breadcrumb (Current Active Item) */}
      <div className="block sm:hidden text-xs font-semibold text-[#123e34] truncate max-w-[220px]">
        {items[items.length - 1]?.label}
      </div>
    </div>
  );
}

export default Breadcrumbs;
