import { PRODUCER_BEAT_PREVIEW_SECONDS } from "@/lib/producer-beat-media";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export async function createProducerBeatPreview(source: File) {
  const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextClass) throw new Error("Secure preview creation is not supported in this browser.");

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData((await source.arrayBuffer()).slice(0));
    const durationSeconds = Math.max(1, Math.min(PRODUCER_BEAT_PREVIEW_SECONDS, Math.floor(decoded.duration)));
    const startSeconds = decoded.duration > PRODUCER_BEAT_PREVIEW_SECONDS + 15
      ? 15
      : 0;
    const frameCount = Math.min(
      Math.floor(durationSeconds * decoded.sampleRate),
      decoded.length - Math.floor(startSeconds * decoded.sampleRate),
    );
    if (frameCount < 1) throw new Error("The beat is too short to create a preview.");

    const channelCount = Math.min(2, decoded.numberOfChannels);
    const wav = encodePcmWav(decoded, channelCount, Math.floor(startSeconds * decoded.sampleRate), frameCount);
    const baseName = source.name.replace(/\.[^.]+$/, "").slice(0, 100) || "beat";
    return {
      file: new File([wav], `${baseName}-preview.wav`, { type: "audio/wav" }),
      durationSeconds,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? `Could not create the store preview: ${error.message}` : "Could not create the store preview.");
  } finally {
    await context.close().catch(() => undefined);
  }
}

function encodePcmWav(buffer: AudioBuffer, channelCount: number, startFrame: number, frameCount: number) {
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const output = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(output);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, frameCount * blockAlign, true);

  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][startFrame + frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

