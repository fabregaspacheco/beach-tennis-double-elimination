import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_DIMENSION = 400;

/** Downscales large logo images before upload — keeps Storage usage and snapshot-export time low. */
async function resizeToPngBlob(file: File, maxDimension = MAX_DIMENSION): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png');
  });
}

export async function uploadSponsorLogo(
  tournamentId: string,
  sponsorId: string,
  file: File,
): Promise<{ logoUrl: string; logoPath: string }> {
  const blob = await resizeToPngBlob(file);
  const logoPath = `sponsors/${tournamentId}/${sponsorId}.png`;
  const storageRef = ref(storage, logoPath);
  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  const logoUrl = await getDownloadURL(storageRef);
  return { logoUrl, logoPath };
}

export async function deleteSponsorLogo(logoPath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, logoPath));
  } catch {
    // Best-effort cleanup — fine if it's already gone.
  }
}
