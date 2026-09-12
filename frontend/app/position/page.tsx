import { PositionPanel } from "@/components/position-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Position",
};

export default function PositionPage() {
  return <PositionPanel />;
}
