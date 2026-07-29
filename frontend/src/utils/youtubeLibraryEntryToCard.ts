import type { YoutubeLibraryEntry, YoutubeCard } from "../types/youtubeLibrary";

export function youtubeLibraryEntryToCard(entry: YoutubeLibraryEntry): YoutubeCard {
  return {
    id: entry.videoId,
    title: entry.title,
    thumbnail: entry.thumbnail,
    channelTitle: entry.channelTitle,
    channelThumbnail: entry.channelThumbnail,
    durationSeconds: entry.durationSeconds,
    viewCount: entry.viewCount,
    entryId: entry.id,
    tags: entry.tags,
  };
}
