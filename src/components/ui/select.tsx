"use client";

import { useId, useMemo, useState } from "react";

export type UiSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  description?: string;
};

type UiSelectProps<TValue extends string = string> = {
  label: string;
  value: TValue;
  options: readonly UiSelectOption<TValue>[];
  onChange: (value: TValue) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function UiSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
  defaultOpen = false,
  disabled = false,
  hideLabel = false
}: UiSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const listboxId = useId();
  const activeOption = useMemo(() => {
    const matched = options.find((option) => option.value === value);
    if (!matched) {
      throw new Error(`UiSelect value is not in options: ${value}`);
    }
    return matched;
  }, [options, value]);

  function choose(nextValue: TValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="ui-select-field group">
      <span
        className={
          hideLabel
            ? "visually-hidden"
            : "mb-1.5 inline-flex items-center text-[13px] font-black tracking-[-0.015em] text-neutral-700"
        }
      >
        {label}
      </span>
      <div className={classNames("relative z-[1]", isOpen && "z-30")}>
        <button
          aria-controls={listboxId}
          aria-expanded={isOpen}
          className={classNames(
            "relative flex min-h-15 w-full items-center justify-between gap-4 overflow-hidden rounded-[22px] border px-4 py-3 text-left transition duration-200",
            "border-neutral-200 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl",
            "before:absolute before:inset-y-2 before:left-2 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-orange-400 before:via-neutral-900 before:to-neutral-300 before:opacity-0 before:transition-opacity",
            "hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-[0_24px_58px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.95)]",
            "focus-visible:border-neutral-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-950/10",
            isOpen && "border-neutral-950 ring-4 ring-neutral-950/10 before:opacity-100",
            disabled && "cursor-not-allowed opacity-55 hover:translate-y-0"
          )}
          disabled={disabled}
          role="combobox"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="relative min-w-0 pl-1">
            <strong className="block truncate text-base font-black tracking-[-0.035em] text-neutral-950">{activeOption.label}</strong>
            {activeOption.description ? (
              <small className="mt-1 block truncate text-[13px] font-medium leading-5 text-neutral-500">{activeOption.description}</small>
            ) : null}
          </span>
          <span
            className={classNames(
              "relative grid size-9 shrink-0 place-items-center rounded-2xl bg-neutral-950 text-sm font-black text-white shadow-[0_10px_26px_rgba(23,23,23,0.24)] transition duration-200",
              isOpen && "rotate-180 bg-orange-500 shadow-[0_10px_26px_rgba(249,115,22,0.28)]"
            )}
            aria-hidden="true"
          >
            ↓
          </span>
        </button>

        {isOpen ? (
          <div
            className="absolute inset-x-0 top-[calc(100%+10px)] overflow-hidden rounded-[24px] border border-neutral-200 bg-white/95 p-2 shadow-[0_30px_90px_rgba(15,23,42,0.20)] ring-1 ring-white/70 backdrop-blur-2xl"
            id={listboxId}
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  aria-selected={selected}
                  className={classNames(
                    "group/option relative flex min-h-16 w-full items-center justify-between gap-4 rounded-[18px] border px-4 py-3 text-left transition duration-150",
                    selected
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-[0_18px_40px_rgba(23,23,23,0.20)]"
                      : "border-transparent bg-transparent text-neutral-950 hover:border-neutral-200 hover:bg-neutral-50"
                  )}
                  key={option.value}
                  role="option"
                  type="button"
                  onClick={() => choose(option.value)}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[15px] font-black tracking-[-0.025em]">{option.label}</strong>
                    {option.description ? (
                      <small className={classNames("mt-1 block truncate text-[13px] leading-5", selected ? "text-white/70" : "text-neutral-500")}>
                        {option.description}
                      </small>
                    ) : null}
                  </span>
                  <span
                    className={classNames(
                      "grid size-8 shrink-0 place-items-center rounded-full text-sm font-black transition",
                      selected ? "bg-white text-neutral-950" : "bg-neutral-100 text-neutral-400 opacity-0 group-hover/option:opacity-100"
                    )}
                    aria-hidden="true"
                  >
                    {selected ? "✓" : "→"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
