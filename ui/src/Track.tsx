import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import config from "./config";
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
    onQueued: () => void;
    onError: (msg: string) => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);
        this.addToQueue = this.addToQueue.bind(this);
    }

    protected addToQueue(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        axios.post(config.backend.url + "/track", { spotifyUri: event.currentTarget.id })
            .then(() => {
                this.props.onQueued();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
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
            <div className={this.props.className + (isPlaying ? " currentTrack " : "") + " trackItem"} id={id} onClick={this.addToQueue}>
                <a href="#" className="trackName">
                    {artist} - {name}
                    {isPlaying ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                </a>
                <a href="#" className="trackDuration"><Duration milliseconds={duration} /></a>
            </div>
        );
    }
}

export default Track;
