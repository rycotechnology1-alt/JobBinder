import { ASSET_CATEGORIES, DEFAULT_ASSET_CATEGORY } from "@/lib/asset-categories";

type Props = {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
};

export function AssetCategorySelect({
  name = "category",
  defaultValue = DEFAULT_ASSET_CATEGORY,
  required = false,
}: Props) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? DEFAULT_ASSET_CATEGORY}
      required={required}
      className="flex h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      {ASSET_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}

