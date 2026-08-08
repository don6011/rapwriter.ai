"use client";

export function createAmbientBuffer(context: AudioContext, key: string) {
  const durationSeconds = 6;
  const frameCount = context.sampleRate * durationSeconds;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  const lower = key.toLowerCase();
  let smoothed = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const noise = Math.random() * 2 - 1;
    smoothed = smoothed * 0.985 + noise * 0.015;
    const time = index / context.sampleRate;
    if (lower.includes("rain")) {
      const drop = Math.random() > 0.9994 ? (Math.random() * 2 - 1) * 0.55 : 0;
      samples[index] = noise * 0.17 + smoothed * 0.2 + drop;
    } else if (lower.includes("vinyl") || lower.includes("analog")) {
      const crackle = Math.random() > 0.9991 ? (Math.random() * 2 - 1) * 0.72 : 0;
      samples[index] = smoothed * 0.42 + noise * 0.025 + crackle;
    } else if (lower.includes("city") || lower.includes("street")) {
      samples[index] = Math.sin(time * Math.PI * 2 * 55) * 0.08 + Math.sin(time * Math.PI * 2 * 91) * 0.025 + smoothed * 0.22;
    } else {
      samples[index] = smoothed * 0.36 + noise * 0.045;
    }
  }

  return buffer;
}
