import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

export async function convertLogoToJpeg(image: Blob): Promise<Buffer> {
  if (image.size === 0 || image.size > MAX_LOGO_SIZE) {
    throw new Error("Le logo doit faire moins de 2 Mo.");
  }

  return sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function getPdfCompatibleLogo(
  supabase: SupabaseClient,
  logoUrl: string | null
): Promise<string | null> {
  if (!logoUrl) return null;

  let image: Buffer;
  if (logoUrl.startsWith("data:image/")) {
    const match = logoUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!match) throw new Error("Le logo enregistré n'a pas un format valide.");
    image = Buffer.from(match[1], "base64");
  } else {
    let objectPath = logoUrl;
    if (/^https?:\/\//i.test(logoUrl)) {
      const parsedUrl = new URL(logoUrl);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || parsedUrl.origin !== new URL(supabaseUrl).origin) {
        throw new Error("L'URL du logo ne correspond pas au stockage de l'entreprise.");
      }

      const match = parsedUrl.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/logos\/(.+)$/
      );
      if (!match) throw new Error("Le chemin du logo dans le stockage est invalide.");
      objectPath = decodeURIComponent(match[1]);
    }

    const { data, error } = await supabase.storage.from("logos").download(objectPath);
    if (error || !data) {
      throw new Error(
        `Impossible de récupérer le logo depuis le stockage: ${error?.message ?? "fichier introuvable"}`
      );
    }
    image = Buffer.from(await data.arrayBuffer());
  }

  const jpeg = await sharp(image, { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
