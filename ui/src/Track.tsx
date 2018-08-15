import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import Duration from "./Duration";

export interface ITrackProps {
    className?: string;
    name: string;
    artist: string;
    id: string;
    artistId: string;
    duration: number;
    progress?: number;
    cover?: string;
    isPlaying: boolean;
    protectedTrack: boolean;
    owned: boolean;
    selectTrack: (targetId: string, isPlaying: boolean) => void;
    selectArtist?: (targetId: string,  isPlaying: boolean) => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);

        this.selectTrack = this.selectTrack.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
    }

    public selectTrack(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.selectTrack(e.currentTarget.id, this.props.isPlaying);
    }

    public selectArtist(e: React.MouseEvent<HTMLElement>) {
        if (this.props.selectArtist) {
            e.preventDefault();
            this.props.selectArtist(e.currentTarget.id, this.props.isPlaying);
        }
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
            owned
        } = this.props;

        return (
            <div className={this.props.className + (isPlaying ? " currentTrack " : "") + " trackItem"}>
                <div className="trackInfo">
                    <a href="#" className="trackName" id={id} onClick={this.selectTrack}>
                        {name}
                        {isPlaying ? <div className="queuedItemIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
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
                <div className="trackDuration"><Duration milliseconds={duration} /></div>
            </div>
        );
    }
}

export default Track;
