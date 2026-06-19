import { ImageResponse } from "next/og";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
          color: "#ffffff",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.08em",
        }}
      >
        T
      </div>
    ),
    size,
  );
}
