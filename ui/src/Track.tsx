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
    selectTrack: (targetId: string, isPlaying: boolean) => void;
    selectArtist: (targetId: string,  isPlaying: boolean) => void;
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
        e.preventDefault();
        this.props.selectArtist(e.currentTarget.id, this.props.isPlaying);
    }

    public render() {
        const {
            name,
            artist,
            artistId,
            id,
            duration,
            isPlaying
        } = this.props;

        return (
            <div className={this.props.className + (isPlaying ? " currentTrack " : "") + " trackItem"}>
                <div className="trackInfo">
                    <a href="#" className="trackName" id={id} onClick={this.selectTrack}>
                        {name}
                        {isPlaying ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                    </a>
                    <a href="#" className="trackArtist" id={artistId} onClick={this.selectArtist}>
                        {artist}
                    </a>
                </div>
                <p className="trackDuration"><Duration milliseconds={duration} /></p>
            </div>
        );
    }
}

export default Track;
