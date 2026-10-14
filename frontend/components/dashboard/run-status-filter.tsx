"use client";
import { useMemo, useState } from "react";
import { Combobox, ComboboxChips, ComboboxChip, ComboboxChipsInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxValue, useComboboxAnchor } from "@/components/ui/combobox";
import { RUN_STATUS_META } from "@/lib/tone";
const statuses = Object.entries(RUN_STATUS_META).filter(([value]) => value !== "partial").map(([value, meta]) => ({ value, label: meta.label }));
type Outcome = typeof statuses[number];

export function RunStatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const anchor = useComboboxAnchor();
  const [search, setSearch] = useState("");
  const selected = useMemo(() => value ? value.split(",").map(value => statuses.find(item => item.value === value)!).filter(Boolean) : [], [value]);
  return <Combobox multiple items={statuses} filteredItems={statuses.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()))} value={selected} inputValue={search} onInputValueChange={setSearch}
    onValueChange={values => { onChange(values.map(item => item.value).join(",")); setSearch(""); }}
    isItemEqualToValue={(item, selected) => item.value === selected.value}>
    <ComboboxChips ref={anchor} className="min-h-11 w-full sm:w-64">
      <ComboboxValue>{(values: Outcome[]) => <>{values.map(status => <ComboboxChip key={status.value} removeLabel={`Remove ${status.label}`}>{status.label}</ComboboxChip>)}</>}</ComboboxValue>
      <ComboboxChipsInput aria-label="Filter run outcomes" placeholder="All outcomes" />
    </ComboboxChips>
    <ComboboxContent anchor={anchor}><ComboboxEmpty>No matching outcomes</ComboboxEmpty><ComboboxList>{(status: Outcome) => <ComboboxItem key={status.value} value={status}>{status.label}</ComboboxItem>}</ComboboxList></ComboboxContent>
  </Combobox>;
}
