import * as google from "googleapis";
import secrets from "./secrets";
import { logger } from "./logger.service";
import * as moment from "moment";
import { SpotifyTrack } from "./spotify";

class YoutubeService {
    public static async getTracks(ids: string) {
        const service = new google.youtube_v3.Youtube({});
        const options = {
            id: ids,
            part: "snippet,contentDetails",
            key: secrets.youtube.key
        }
        return await service.videos.list(options).then(response => {
            if (!response.data.items) {
                throw { status: 404, message: "No videos found with given ids." };
            }

            let videos = response.data.items.map((item: google.youtube_v3.Schema$Video) => {
                if (item.contentDetails && item.snippet) {
                    const duration = moment.duration(item.contentDetails.duration).asMilliseconds();
                    if (!duration) {
                        return null;
                    }

                    const track: SpotifyTrack = {
                        artist: item.snippet.channelTitle!,
                        artistId: item.snippet.channelId!,
                        id: item.id!,
                        name: item.snippet.title!,
                        cover: (item.snippet.thumbnails && item.snippet.thumbnails.default) ? item.snippet.thumbnails.default.url! : "",
                        duration,
                        progress: 0,
                        isFavorite: false,
                        source: "youtube",
                    };
                    return track;
                } else {
                    return null;
                }
            }).filter(item => item !== null) as SpotifyTrack[];

            if (!videos || videos.length === 0) {
                throw { status: 404, message: "No videos found from YouTube." };
            }

            return videos;
        }).catch(err => {
            logger.error(err);
            throw { status: 500, message: "Unexpected error when getting video data from YouTube." };
        });
    }
}

export default YoutubeService;