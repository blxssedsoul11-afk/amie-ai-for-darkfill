import assert from "node:assert/strict";
import test from "node:test";
import { MISTRAL_AUDIO_TRANSCRIPTION_URL, MISTRAL_TRANSCRIPTION_MODEL } from "./config.js";
import { transcribeVoiceAudio } from "./mistral.js";

test("voice transcription uploads a WAV to Mistral and returns its text", async () => {
  const originalKey = process.env["MISTRAL_API_KEY"];
  const originalFetch = globalThis.fetch;
  const uploadedForms: FormData[] = [];
  process.env["MISTRAL_API_KEY"] = "test-key";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), MISTRAL_AUDIO_TRANSCRIPTION_URL);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    if (init?.body instanceof FormData) uploadedForms.push(init.body);
    return new Response(JSON.stringify({ text: "Hey Amie, can you hear me?" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const transcript = await transcribeVoiceAudio(Buffer.alloc(48));
    assert.equal(transcript, "Hey Amie, can you hear me?");
    const uploadedForm = uploadedForms[0];
    assert.ok(uploadedForm);
    assert.equal(uploadedForm.get("model"), MISTRAL_TRANSCRIPTION_MODEL);
    const file = uploadedForm.get("file");
    assert.ok(file instanceof Blob);
    assert.equal(file.type, "audio/wav");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env["MISTRAL_API_KEY"];
    else process.env["MISTRAL_API_KEY"] = originalKey;
  }
});
