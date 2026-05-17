import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
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

type FlagsDialogProps = { onClose(): void };

export function FlagsDialog({ onClose }: FlagsDialogProps) {
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

  return (
    <Modal title="Flag Explorer" onClose={onClose}>
      {error ? (
        <div className={`${shared.status} ${shared.error}`}>{error}</div>
      ) : !data ? (
        <div className={shared.status}>Loading…</div>
      ) : (
        <DataTable
          groups={[
            { label: `Daily — day ${data.daynumber}`, rows: Object.entries(data.daily).map(([key, value]) => ({ key, value })) },
            { label: `Ascension — #${data.ascensions}`, rows: Object.entries(data.ascension).map(([key, value]) => ({ key, value })) },
            { label: "Permanent", rows: Object.entries(data.permanent).map(([key, value]) => ({ key, value })) },
          ]}
        />
      )}
    </Modal>
  );
}

export function registerFlagsCommand(openDialog: (id: string) => void): void {
  registerCommand({
    id: "flags",
    label: "Flag Explorer",
    keywords: ["flags", "daily", "ascension", "permanent", "debug"],
    action: () => openDialog("flags"),
  });
}
