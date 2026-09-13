/** Rung geometry from public/icons/ladder-icon.svg, for OG / apple-touch ImageResponse. */
export function BrandMark({ size }: { size: number }) {
  const pad = size * (25 / 120);
  const barH = size * (10 / 120);
  const barW = size * (70 / 120);
  const step = size * (20 / 120);
  const radius = size * (28 / 120);
  const barRadius = barH / 2;
  const y = (i: number) => pad + i * step;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        borderRadius: radius,
        background: "#023047",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(1),
          width: barW,
          height: barH,
          borderRadius: barRadius,
          background: "#8ECAE6",
          opacity: 0.22,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(3),
          width: barW,
          height: barH,
          borderRadius: barRadius,
          background: "#8ECAE6",
          opacity: 0.22,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(0),
          width: barW,
          height: barH,
          borderRadius: barRadius,
          background: "#8ECAE6",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(1),
          width: size * (43 / 120),
          height: barH,
          borderRadius: barRadius,
          background: "#8ECAE6",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(2),
          width: barW,
          height: barH,
          borderRadius: barRadius,
          background: "#FFB703",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pad,
          top: y(3),
          width: size * (55 / 120),
          height: barH,
          borderRadius: barRadius,
          background: "#8ECAE6",
        }}
      />
    </div>
  );
}
