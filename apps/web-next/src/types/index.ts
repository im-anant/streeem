export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}
