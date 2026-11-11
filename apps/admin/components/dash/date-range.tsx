"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { usePopover } from "../../lib/dash/hooks";
import { type DashRange, RANGE_OPTIONS, rangeLabel } from "../../lib/dash/range";
import { CustomRangeDialog } from "./custom-range";
import { CheckIcon, ClockIcon } from "./icons";
import { BUTTON, FOCUS } from "./ui";

/** The range button and its menu: Today, 7, 30, 90 days, Custom range... (opens a calendar). */
export function DateRangeMenu({
  range,
  onChange,
}: {
  range: DashRange;
  onChange: (next: DashRange) => void;
}) {
  const { open, setOpen, rootRef, buttonRef } = usePopover();
  const [custom, setCustom] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        const list = items();
        (event.key === "ArrowUp" ? list[list.length - 1] : list[0])?.focus();
      });
    }
  };
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    let target: HTMLElement | undefined;
    if (event.key === "ArrowDown") target = list[(at + 1) % list.length];
    else if (event.key === "ArrowUp") target = list[(at - 1 + list.length) % list.length];
    else if (event.key === "Home") target = list[0];
    else if (event.key === "End") target = list[list.length - 1];
    else return;
    event.preventDefault();
    target?.focus();
  };

  const choose = (next: DashRange) => {
    setOpen(false);
    buttonRef.current?.focus();
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={onButtonKey}
        className={`${BUTTON} ${FOCUS}`}
      >
        <ClockIcon />
        <span>{rangeLabel(range)}</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Date range"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[200px] rounded-2xl border border-border-alpha bg-bg-base p-2 shadow-[0_8px_28px_rgba(9,10,11,0.14)]"
        >
          {RANGE_OPTIONS.map((o) => {
            const checked = range.key === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => choose({ key: o.key })}
                className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[14px] text-text hover:bg-bg-fill2 ${FOCUS} ${checked ? "bg-bg-fill2" : ""}`}
              >
                {o.label}
                {checked ? <CheckIcon /> : null}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={range.key === "custom"}
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
              setCustom(true);
            }}
            className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[14px] text-text hover:bg-bg-fill2 ${FOCUS} ${range.key === "custom" ? "bg-bg-fill2" : ""}`}
          >
            Custom range...
            {range.key === "custom" ? <CheckIcon /> : null}
          </button>
        </div>
      ) : null}
      {custom ? (
        <CustomRangeDialog
          initial={range}
          onClose={() => setCustom(false)}
          onApply={(next) => {
            setCustom(false);
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}
