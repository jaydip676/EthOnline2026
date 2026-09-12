import { CoveragePanel } from "@/components/coverage-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coverage",
};

export default function CoveragePage() {
  return <CoveragePanel />;
}
