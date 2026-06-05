export const streamProfileNames = ["360p", "720p", "1080p", "auto"] as const;

export type StreamProfileName = (typeof streamProfileNames)[number];

export interface StreamProfile {
  name: StreamProfileName;
  label: string;
  width: number;
  height: number;
  mediaWidth: number;
}

export const streamProfiles: Record<StreamProfileName, StreamProfile> = {
  "360p": {
    name: "360p",
    label: "360P",
    width: 640,
    height: 360,
    mediaWidth: 640
  },
  "720p": {
    name: "720p",
    label: "720P",
    width: 1280,
    height: 720,
    mediaWidth: 1280
  },
  "1080p": {
    name: "1080p",
    label: "1080P",
    width: 1920,
    height: 1080,
    mediaWidth: 1920
  },
  auto: {
    name: "auto",
    label: "AUTO",
    width: 1280,
    height: 720,
    mediaWidth: 1280
  }
};

export function isStreamProfileName(value: unknown): value is StreamProfileName {
  return typeof value === "string" && streamProfileNames.includes(value as StreamProfileName);
}

export function resolveStreamProfile(value: StreamProfileName): StreamProfile {
  return streamProfiles[value];
}
