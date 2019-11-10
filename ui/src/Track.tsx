import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import Duration from "./Duration";
import Time from "./Time";

export interface ITrackProps {
    className?: string;
    name: string;
    artist: string;
    id: string;
    trackId: string;
    artistId: string;
    duration: number;
    totalDuration?: number;
    cover?: string;
    isPlaying: boolean;
    protectedTrack: boolean;
    owned: boolean;
    source?: "youtube" | "spotify";
    isFavorite: boolean;
    votes?: number;
    index: number;
    selectTrack: (targetId: string, isPlaying: boolean, index: number) => void;
    selectArtist?: (targetId: string,  isPlaying: boolean) => void;
    toggleFromFavorites: (targetId: string, source: string, isFavorite: boolean) => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);

        this.selectTrack = this.selectTrack.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
        this.toggleFromFavorites = this.toggleFromFavorites.bind(this);
    }

    public selectTrack(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.selectTrack(e.currentTarget.id, this.props.isPlaying, this.props.index);
    }

    public selectArtist(e: React.MouseEvent<HTMLElement>) {
        if (this.props.selectArtist) {
            e.preventDefault();
            this.props.selectArtist(e.currentTarget.id, this.props.isPlaying);
        }
    }

    public toggleFromFavorites(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.toggleFromFavorites(this.props.trackId, this.props.source!, this.props.isFavorite);
    }

    public render() {
        const {
            name,
            artist,
            artistId,
            id,
            duration,
            isPlaying,
            protectedTrack,
            owned,
            source,
            isFavorite,
            votes,
        } = this.props;

        return (
            <div className={this.props.className + " trackItem" + (isPlaying ? " currentTrack " : "")}>
                <div className="toggleFavorite">
                    {this.toggleFromFavorites
                      ? <a className={"favorited"} href="#" onClick={this.toggleFromFavorites} title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
                          <FontAwesomeIcon icon={[isFavorite ? "fas" : "far", "star"]} />
                        </a>
                      : null}
                    {votes || votes === 0
                      ? <div className="votes">{votes}</div>
                      : null}
                </div>
                <div className="trackInfo">
                    <a href="#" className="trackName" id={id} onClick={this.selectTrack}>
                        {name}
                        {isPlaying ? <div className="queuedItemIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                        {source
                            ? source  === "youtube"
                                ? <div className="queuedItemIcon"><FontAwesomeIcon icon={["fab", "youtube"]} /></div>
                                : <div className="queuedItemIcon"><FontAwesomeIcon icon={["fab", "spotify"]} /></div>
                            : null}
                        {protectedTrack
                            ? <div className="queuedItemIcon" title="Protected track, can't be skipped or removed">
                                <FontAwesomeIcon icon="shield-alt" />
                              </div>
                            : null}
                        {owned ? <div className="queuedItemIcon" title="Added by you"><FontAwesomeIcon icon="user" /></div> : null}
                    </a>
                    <a href={"#artist=" + artistId} className="trackArtist" id={artistId} onClick={this.selectArtist}>
                        {artist}
                    </a>
                </div>
                <div className="trackDuration">
                  <Duration milliseconds={duration} />
                  <Time afterMillis={this.props.totalDuration} />
                </div>
            </div>
        );
    }
}

export default Track;
