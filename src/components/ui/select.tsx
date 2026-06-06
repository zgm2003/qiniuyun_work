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
    <div className="ui-select-field">
      <span className={hideLabel ? "visually-hidden" : "ui-field-label"}>
        {label}
      </span>
      <div className={classNames("ui-select", isOpen && "open")}>
        <button
          aria-controls={listboxId}
          aria-expanded={isOpen}
          className="ui-select-trigger"
          disabled={disabled}
          role="combobox"
          type="button"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>
            <strong>{activeOption.label}</strong>
            {activeOption.description ? (
              <small>{activeOption.description}</small>
            ) : null}
          </span>
          <span className="ui-select-chevron" aria-hidden="true">
            ▾
          </span>
        </button>

        {isOpen ? (
          <div
            className="ui-select-popover"
            id={listboxId}
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  aria-selected={selected}
                  className={classNames("ui-select-option", selected && "selected")}
                  key={option.value}
                  role="option"
                  type="button"
                  onClick={() => choose(option.value)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description ? (
                      <small>{option.description}</small>
                    ) : null}
                  </span>
                  {selected ? <span className="ui-select-check" aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
