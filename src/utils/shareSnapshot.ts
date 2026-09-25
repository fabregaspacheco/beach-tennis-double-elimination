import { toPng } from 'html-to-image';

const SNAPSHOT_BACKGROUND = '#fbf3e3';

/**
 * Renders a DOM node to a PNG data URL. Bracket columns normally scroll horizontally
 * (`.bracket-section` has overflow-x: auto), so a plain capture would only include whatever is
 * currently scrolled into view. This temporarily widens those sections to their full content
 * width so nothing is clipped — and widens `node` itself to match, since a wider child doesn't
 * pull its ancestors along with it (they'd just let it visually overflow past their own edge,
 * which is exactly what would get cropped out of the image otherwise) — then restores the
 * original layout.
 */
export async function captureNodeAsPng(node: HTMLElement): Promise<string> {
  const scrollers = Array.from(node.querySelectorAll<HTMLElement>('.bracket-section'));
  const contentWidth = Math.max(node.clientWidth, ...scrollers.map((el) => el.scrollWidth));

  const originalNodeWidth = node.style.width;
  const originalScrollerWidths = scrollers.map((el) => el.style.width);

  node.style.width = `${contentWidth}px`;
  scrollers.forEach((el) => {
    el.style.width = `${contentWidth}px`;
  });

  try {
    return await toPng(node, {
      backgroundColor: SNAPSHOT_BACKGROUND,
      pixelRatio: 2,
      cacheBust: true,
      width: contentWidth,
      height: node.scrollHeight,
    });
  } finally {
    node.style.width = originalNodeWidth;
    scrollers.forEach((el, i) => {
      el.style.width = originalScrollerWidths[i];
    });
  }
}

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Captures `node` as an image and either opens the device's native share sheet (so the user can
 * send it straight to a WhatsApp group, for example) or, when that's not available, downloads it
 * as a file to share manually.
 */
export async function shareNodeAsImage(
  node: HTMLElement,
  fileName: string,
  shareTitle: string,
  shareText: string,
): Promise<ShareOutcome> {
  const dataUrl = await captureNodeAsPng(node);
  const file = await dataUrlToFile(dataUrl, fileName);

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle, text: shareText });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }

  downloadFile(file);
  return 'downloaded';
}
