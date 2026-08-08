import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CityPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  query.set("layer", "city");

  for (const key of ["filter", "view", "lat", "lng"] as const) {
    const value = first(params[key]);
    if (value) query.set(key, value);
  }

  redirect(`/map?${query.toString()}`);
}
