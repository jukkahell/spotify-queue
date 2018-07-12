import * as React from "react";
import { IQueuedItem } from "./Queue";

interface ICurrentlyPlayingProps {
    onSongEnd: () => void;
    onError: (msg: string) => void;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
}

interface ICurrentlyPlayingState {
    trackId: string;
    progress: number;
    progressUpdated: number;
}

export class CurrentlyPlaying extends React.Component<ICurrentlyPlayingProps, ICurrentlyPlayingState> {

    private progressInterval: NodeJS.Timer;

    public constructor(props: ICurrentlyPlayingProps) {
        super(props);
        this.state = {
            trackId: "",
            progress: 0,
            progressUpdated: 0
        };
    }

    public componentDidMount() {
        if (this.props.isPlaying) {
            this.startProgress();
        }
    }

    public componentWillUnmount() {
        clearInterval(this.progressInterval);
    }

    public componentDidUpdate(prevProps: ICurrentlyPlayingProps) {
        if (this.props.currentTrack && this.props.currentTrack.track.id !== this.state.trackId) {
            this.setState({
                trackId: this.props.currentTrack.track.id,
                progress: this.props.currentTrack.track.progress!,
                progressUpdated: (new Date).getTime()
            }, this.startProgress);
        } else if (!this.props.isPlaying) {
            clearInterval(this.progressInterval);
        }
    }

    public render() {
        if (this.props.currentTrack) {
            const progress = (this.state.progress / this.props.currentTrack.track.duration) * 100;

            return (
                <div className="currentlyPlaying col-md-12">
                    <img className="coverImage" src={this.props.currentTrack.track.cover} />
                    <div className="progress">
                        <div className="progress-bar" style={{width: progress + "%"}} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    private startProgress() {
        clearInterval(this.progressInterval);
        this.progressInterval = setInterval(() => {
            const elapsed = (new Date).getTime() - this.state.progressUpdated;
            this.setState((prevState) => ({
                progress: (prevState.progress + elapsed),
                progressUpdated: (new Date).getTime()
            }));

            const progress = (this.state.progress / this.props.currentTrack!.track.duration) * 100;

            if (progress >= 100) {
                clearInterval(this.progressInterval);
                this.props.onSongEnd();
            }
        }, 500);
    }
}

export default CurrentlyPlaying;
