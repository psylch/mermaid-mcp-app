/**
 * Export utilities for Mermaid diagrams.
 * All rendering is client-side (Mermaid renders locally).
 */

/** Download a Blob as a file. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export the current SVG string as a .svg file. */
export function exportSvg(svgContent: string, filename = "diagram.svg") {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  downloadBlob(blob, filename);
}

/** Export the diagram as PNG via client-side Canvas rendering. */
export async function exportPng(svgContent: string, filename = "diagram.png"): Promise<void> {
  const img = new Image();
  const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    img.onload = () => {
      const scale = 2; // Retina-quality export
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}
