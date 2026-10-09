import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { convertLogoToJpeg } from "../company-logo";

describe("company logo conversion", () => {
  it("converts an existing WebP logo to JPEG supported by the PDF renderer", async () => {
    const webp = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 30, g: 58, b: 95, alpha: 1 },
      },
    })
      .webp()
      .toBuffer();

    const jpeg = await convertLogoToJpeg(new Blob([webp], { type: "image/webp" }));

    expect(jpeg.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });
});
