import { google, youtube_v3 } from "googleapis";
import * as moment from "moment";
import { logger } from "./logger.service";
import secrets from "./secrets";
import { SpotifyTrack } from "./spotify";

class YoutubeService {
  public static async getTracks(ids: string) {
    const youtube = google.youtube("v3");
    const options = {
      id: ids.split(","),
      part: ["snippet", "contentDetails"],
      key: secrets.youtube.key
    };
    return await youtube.videos
      .list(options)
      .then((response: any) => {
        if (!response.data.items) {
          throw { status: 404, message: "No videos found with given ids." };
        }

        const videos = response.data.items
          .map((item: youtube_v3.Schema$Video) => {
            if (item.contentDetails && item.snippet) {
              const duration = moment
                .duration(item.contentDetails.duration)
                .asMilliseconds();
              if (!duration) {
                return null;
              }

              const track: SpotifyTrack = {
                artist: item.snippet.channelTitle!,
                artistId: item.snippet.channelId!,
                id: item.id!,
                name: item.snippet.title!,
                cover:
                  item.snippet.thumbnails && item.snippet.thumbnails.default
                    ? item.snippet.thumbnails.default.url!
                    : "",
                duration,
                progress: 0,
                isFavorite: false,
                source: "youtube"
              };
              return track;
            } else {
              return null;
            }
          })
          .filter((item: SpotifyTrack) => item !== null);

        if (!videos || videos.length === 0) {
          throw { status: 404, message: "No videos found from YouTube." };
        }

        return videos;
      })
      .catch((err: any) => {
        logger.error(err);
        throw {
          status: 500,
          message: "Unexpected error when getting video data from YouTube."
        };
      });
  }
}

export default YoutubeService;
