type WebAudioSessionType = "play-and-record" | "playback";

type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type: WebAudioSessionType | "auto";
  };
};

/**
 * iOS switches WebViews to a call-style audio route while the microphone is
 * active. Restore an explicit playback route before listening to a take so
 * the speaker does not remain quiet or ducked after recording.
 */
export function setWebAudioSessionType(type: WebAudioSessionType) {
  if (typeof navigator === "undefined") return;
  try {
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (audioSession) audioSession.type = type;
  } catch {
    // Older browsers do not expose the Audio Session API.
  }
}
