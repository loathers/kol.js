import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import shared from "../shared.module.css";
import { registerCommand } from "./registry";

type FlagsSnapshot = {
  username: string;
  daynumber: number;
  ascensions: number;
  daily: Record<string, unknown>;
  ascension: Record<string, unknown>;
  permanent: Record<string, unknown>;
};

type FlagsViewProps = { onClose(): void };

export function FlagsView({ onClose: _ }: FlagsViewProps) {
  const [data, setData] = useState<FlagsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/_kolappse/api/flags")
      .then((r) => r.json() as Promise<FlagsSnapshot>)
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load flags"),
      );
  }, []);

  if (error) return <div className={`${shared.status} ${shared.error}`}>{error}</div>;
  if (!data) return <div className={shared.status}>Loading…</div>;

  return (
    <DataTable
      groups={[
        { label: `Daily - day ${data.daynumber}`, rows: Object.entries(data.daily).map(([key, value]) => ({ key, value })) },
        { label: `Ascension - #${data.ascensions}`, rows: Object.entries(data.ascension).map(([key, value]) => ({ key, value })) },
        { label: "Permanent", rows: Object.entries(data.permanent).map(([key, value]) => ({ key, value })) },
      ]}
    />
  );
}

export function registerFlagsCommand(): void {
  registerCommand({
    id: "flags",
    label: "Flag Explorer",
    icon: "F",
    keywords: ["flags", "daily", "ascension", "permanent", "debug"],
    view: FlagsView,
  });
}
