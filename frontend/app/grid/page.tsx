import type { Metadata } from "next";
import { GridWizard } from "@/components/grid-wizard";

export const metadata: Metadata = {
  title: "Grid",
};

export default function GridPage() {
  return <GridWizard />;
}
