import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import Duration from "./Duration";

export interface ITrackProps {
    className?: string;
    name: string;
    artist: string;
    id: string;
    duration: number;
    progress?: number;
    cover?: string;
    isPlaying: boolean;
    onClick: (targetId: string, isPlaying: boolean) => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    public onClick(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.onClick(e.currentTarget.id, this.props.isPlaying);
    }

    public render() {
        const {
            name,
            artist,
            id,
            duration,
            isPlaying
        } = this.props;

        return (
            <div className={this.props.className + (isPlaying ? " currentTrack " : "") + " trackItem"} id={id} onClick={this.onClick}>
                <div className="trackInfo">
                    <a href="#" className="trackName">
                        {name}
                        {isPlaying ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                    </a>
                    <a href="#" className="artistName">
                        {artist}
                    </a>
                </div>
                <a href="#" className="trackDuration"><Duration milliseconds={duration} /></a>
            </div>
        );
    }
}

export default Track;
