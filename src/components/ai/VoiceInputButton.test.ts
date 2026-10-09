import { describe, expect, it } from "vitest";
import { getFinalSpeechTranscript } from "./VoiceInputButton";

describe("getFinalSpeechTranscript", () => {
  it("collects all final speech chunks and ignores interim results", () => {
    const transcript = getFinalSpeechTranscript({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "Facture pour Awa" } },
        { isFinal: false, 0: { transcript: "deux ordinateurs" } },
        { isFinal: true, 0: { transcript: "deux ordinateurs à 250000 francs" } },
        { isFinal: true, 0: { transcript: "et une souris à 5000" } },
      ],
    });

    expect(transcript).toBe(
      "Facture pour Awa deux ordinateurs à 250000 francs et une souris à 5000"
    );
  });

  it("returns only newly finalized chunks from resultIndex", () => {
    const transcript = getFinalSpeechTranscript({
      resultIndex: 1,
      results: [
        { isFinal: true, 0: { transcript: "déjà reçu" } },
        { isFinal: true, 0: { transcript: "installation à 10000" } },
      ],
    });

    expect(transcript).toBe("installation à 10000");
  });
});
